import "server-only";
import { randomBytes } from "node:crypto";
import { createAdminClient } from "../supabase/admin";
import { normalizeDesign, type Design } from "../design";
import { normalizeChat, type ChatMessage } from "../chat";
import { clampToAllowed, describeChanges, linkState, normalizeAllow, type Allow } from "./links";

/**
 * Server-side access to client links. Clients don't sign in, so every read and write here goes through the service
 * role after checking the link's token; nothing about links is reachable with the public key.
 */

export const newToken = () => randomBytes(32).toString("base64url");
/** a token is 43 base64url characters; anything else is turned away before touching the database */
export const isToken = (t: string) => /^[A-Za-z0-9_-]{43}$/.test(t);

export type LinkRow = {
  id: string; token: string; owner: string; client_name: string; note: string; design_ids: string[]; allow: unknown;
  ai_daily_limit: number; expires_at: string | null; revoked: boolean; created_at: string; last_opened_at: string | null;
};
export type ClientPiece = { designId: string; name: string; base: Design; version: Design; chat: ChatMessage[] };
export type ClientBundle = { link: LinkRow; allow: Allow; state: ReturnType<typeof linkState>; pieces: ClientPiece[] };

const db = () => createAdminClient();

export async function linkByToken(token: string): Promise<LinkRow | null> {
  // no database yet (a studio still being set up): no links exist
  if (!isToken(token) || !process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) return null;
  const { data } = await db().from("client_links").select("*").eq("token", token).maybeSingle();
  return (data as LinkRow | null) ?? null;
}

/** everything a client link shows: its pieces, each as the jeweller made it and as the client has adjusted it */
export async function loadClientBundle(token: string): Promise<ClientBundle | null> {
  const link = await linkByToken(token);
  if (!link) return null;
  const allow = normalizeAllow(link.allow);
  const state = linkState(link);
  if (state !== "active") return { link, allow, state, pieces: [] };
  const [{ data: designs }, { data: versions }] = await Promise.all([
    db().from("designs").select("id, name, data").in("id", link.design_ids),
    db().from("client_versions").select("design_id, data, chat").eq("link_id", link.id),
  ]);
  const pieces = link.design_ids.flatMap((id) => {
    const d = designs?.find((x) => x.id === id);
    if (!d) return [];
    const base = normalizeDesign(d.data);
    const v = versions?.find((x) => x.design_id === id);
    return [{ designId: id, name: d.name, base, version: v ? clampToAllowed(base, normalizeDesign(v.data), allow) : base, chat: normalizeChat(v?.chat) }];
  });
  return { link, allow, state, pieces };
}

export async function recordEvent(linkId: string, designId: string | null, kind: string, detail: Record<string, unknown> = {}) {
  await db().from("link_events").insert({ link_id: linkId, design_id: designId, kind, detail });
}

export async function markOpened(link: LinkRow) {
  await Promise.all([db().from("client_links").update({ last_opened_at: new Date().toISOString() }).eq("id", link.id), recordEvent(link.id, null, "opened")]);
}

/** save the client's adjusted piece (clamped to what's allowed), noting what changed since their last save */
export async function saveClientVersion(bundle: ClientBundle, designId: string, proposed: unknown): Promise<Design | null> {
  const piece = bundle.pieces.find((p) => p.designId === designId);
  if (!piece) return null;
  const version = clampToAllowed(piece.base, normalizeDesign(proposed), bundle.allow);
  const changed = JSON.stringify(version) !== JSON.stringify(piece.version);
  await db().from("client_versions").upsert({ link_id: bundle.link.id, design_id: designId, data: version, updated_at: new Date().toISOString() });
  if (changed) await recordEvent(bundle.link.id, designId, "changed", { changes: describeChanges(piece.base, version) });
  return version;
}

export async function saveClientChat(bundle: ClientBundle, designId: string, chat: ChatMessage[]) {
  const piece = bundle.pieces.find((p) => p.designId === designId);
  if (!piece) return;
  await db().from("client_versions").upsert({ link_id: bundle.link.id, design_id: designId, data: piece.version, chat: normalizeChat(chat), updated_at: new Date().toISOString() });
}

export async function spendLinkAiCall(link: LinkRow): Promise<boolean> {
  if (link.ai_daily_limit <= 0) return false;
  const { data, error } = await db().rpc("use_link_ai_call", { lid: link.id, daily_limit: link.ai_daily_limit });
  return !error && !!data;
}

/* ---------------- the studio's view (master accounts only; callers check isStudioAdmin) ---------------- */

export type Account = { id: string; name: string; lastSignIn: string | null };

export async function listAccounts(): Promise<Account[]> {
  const out: Account[] = [];
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db().auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) break;
    out.push(...data.users.map((u) => ({ id: u.id, name: (u.user_metadata?.display_name as string) || u.email || "Unnamed", lastSignIn: u.last_sign_in_at ?? null })));
    if (data.users.length < 200) break;
  }
  return out;
}

export async function allDesigns() {
  const { data } = await db().from("designs").select("id, owner, name, data, status, updated_at, thumbnail_path").order("updated_at", { ascending: false }).limit(500);
  return data ?? [];
}

export async function designById(id: string) {
  const { data } = await db().from("designs").select("id, owner, name, data, status").eq("id", id).maybeSingle();
  return data;
}

export async function allLinks() {
  const { data } = await db().from("client_links").select("*").order("created_at", { ascending: false }).limit(300);
  return (data ?? []) as LinkRow[];
}

export async function linkById(id: string) {
  const { data } = await db().from("client_links").select("*").eq("id", id).maybeSingle();
  return (data as LinkRow | null) ?? null;
}

export async function recentEvents(limit = 200, linkId?: string) {
  let q = db().from("link_events").select("id, link_id, design_id, kind, detail, at").order("at", { ascending: false }).limit(limit);
  if (linkId) q = q.eq("link_id", linkId);
  const { data } = await q;
  return data ?? [];
}

export async function createLink(owner: string, input: { clientName: string; note: string; designIds: string[]; allow: Allow; expiresInDays: number; aiDailyLimit: number }) {
  const token = newToken();
  const expires_at = input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString() : null;
  const { data, error } = await db().from("client_links").insert({
    token, owner, client_name: input.clientName, note: input.note, design_ids: input.designIds, allow: input.allow,
    ai_daily_limit: input.aiDailyLimit, expires_at,
  }).select("id, token").single();
  if (error) throw new Error(error.message);
  return data as { id: string; token: string };
}

export async function updateLink(id: string, patch: Partial<Pick<LinkRow, "revoked" | "expires_at">>) {
  const { error } = await db().from("client_links").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

/** a link with its pieces as sent, the client's versions and conversations, and its events */
export async function linkDetail(id: string) {
  const link = await linkById(id);
  if (!link) return null;
  const [{ data: designs }, { data: versions }, events] = await Promise.all([
    db().from("designs").select("id, name, data").in("id", link.design_ids),
    db().from("client_versions").select("design_id, data, chat, updated_at").eq("link_id", id),
    recentEvents(300, id),
  ]);
  const allow = normalizeAllow(link.allow);
  const pieces = link.design_ids.flatMap((did) => {
    const d = designs?.find((x) => x.id === did);
    if (!d) return [];
    const base = normalizeDesign(d.data);
    const v = versions?.find((x) => x.design_id === did);
    const version = v ? clampToAllowed(base, normalizeDesign(v.data), allow) : base;
    return [{ designId: did, name: d.name, base, version, changes: describeChanges(base, version), chat: normalizeChat(v?.chat), updatedAt: (v?.updated_at as string | undefined) ?? null }];
  });
  return { link, allow, state: linkState(link), pieces, events };
}

/** a client's version of one piece (for the spec sheet) */
export async function clientVersion(linkId: string, designId: string) {
  const detail = await linkDetail(linkId);
  const p = detail?.pieces.find((x) => x.designId === designId);
  return p && detail ? { ...p, clientName: detail.link.client_name } : null;
}
