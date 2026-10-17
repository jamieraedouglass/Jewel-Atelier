"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DesignSchema, normalizeDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { backupRows } from "@/lib/backup";
import { StylePrefsSchema, type StylePrefs } from "@/lib/style/profile";
import { loadStyleProfile } from "@/lib/style/load";
import { normalizeChat, type ChatMessage } from "@/lib/chat";
import { normalizeInventory, normalizeStatus, type Status } from "@/lib/inventory";

export async function saveDesign(id: string | null, raw: unknown): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in to save designs." };
  const parsed = DesignSchema.safeParse(raw);
  if (!parsed.success) return { error: "This design has a value the app can't save. Undo the last change and try again." };
  const data = parsed.data;
  if (id) {
    const { data: updated, error } = await supabase.from("designs").update({ data, name: data.name, updated_at: new Date().toISOString() }).eq("id", id).eq("owner", user.id).select("id");
    if (error) return failed("save", error);
    if (!updated?.length) return { error: "This design no longer exists (it may have been deleted in another tab). Make a copy to keep it." };
    await keepVersion(supabase, id, data);
    revalidatePath(`/d/${id}`);
    revalidatePath("/rings");
    return { id };
  }
  const { data: row, error } = await supabase.from("designs").insert({ data, name: data.name }).select("id").single();
  if (error) return failed("save", error);
  await keepVersion(supabase, row.id, data);
  revalidatePath("/rings");
  return { id: row.id };
}

function failed(what: string, error: { message: string }) {
  console.error(`${what} failed:`, error.message);
  return { error: `Couldn't ${what} just now. Please try again.` };
}

const copyName = (name: string) => {
  const base = name.replace(/ \(copy( \d+)?\)$/, "");
  return `${base.slice(0, 80 - " (copy)".length)} (copy)`;
};

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function keepVersion(supabase: Supa, designId: string, data: ReturnType<typeof normalizeDesign>) {
  try {
    await supabase.from("design_versions").insert({ design_id: designId, name: data.name, data });
    const { data: old } = await supabase.from("design_versions").select("id").eq("design_id", designId).order("created_at", { ascending: false }).range(40, 200);
    if (old?.length) await supabase.from("design_versions").delete().in("id", old.map((v) => v.id));
  } catch {}
}

export async function listVersions(designId: string): Promise<{ id: string; name: string; created_at: string; data: unknown }[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase.from("design_versions").select("id, name, created_at, data").eq("design_id", designId).order("created_at", { ascending: false }).limit(40);
  return data ?? [];
}

export async function duplicateDesign(raw: unknown): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in to make copies." };
  const src = normalizeDesign(raw);
  const data = { ...src, name: copyName(src.name) };
  const { data: row, error } = await supabase.from("designs").insert({ data, name: data.name }).select("id").single();
  if (error) return failed("copy", error);
  await keepVersion(supabase, row.id, data);
  revalidatePath("/rings");
  return { id: row.id };
}

export async function setThumbnail(id: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user || !path.startsWith(`${user.id}/`)) return;
  const { data: before } = await supabase.from("designs").select("thumbnail_path").eq("id", id).eq("owner", user.id).maybeSingle();
  await supabase.from("designs").update({ thumbnail_path: path }).eq("id", id).eq("owner", user.id);
  const old = (before as { thumbnail_path?: string | null } | null)?.thumbnail_path;
  if (old && old !== path && old.startsWith(`${user.id}/`)) await supabase.storage.from("thumbnails").remove([old]).catch(() => {});
  revalidatePath("/rings");
}

export async function setPublic(id: string, isPublic: boolean): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in first." };
  const { data, error } = await supabase.from("designs").update({ is_public: isPublic }).eq("id", id).eq("owner", user.id).select("id");
  if (error) return failed(isPublic ? "share the link" : "turn off the link", error);
  if (!data?.length) return { error: "This design no longer exists." };
  revalidatePath(`/d/${id}`);
  return {};
}

export async function deleteDesign(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await supabase.from("designs").delete().eq("id", id).eq("owner", user.id);
  revalidatePath("/rings");
}

export async function copyDesign(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/login?next=/d/${id}`);
  const { data: src } = await supabase.from("designs").select("data, name, owner").eq("id", id).single();
  if (!src) redirect("/rings");
  const data = { ...normalizeDesign(src.data), name: copyName(src.name) };
  if (src.owner !== user.id) data.center = { ...data.center, photoPath: null };
  const { data: row } = await supabase.from("designs").insert({ data, name: data.name }).select("id").single();
  redirect(row ? `/design/${row.id}` : "/rings");
}

const StyleProfileInput = z.object({
  icons: z.array(z.string().max(200)).max(50),
  notes: z.string().max(20000),
  image_paths: z.array(z.string().max(300)).max(50),
  prefs: z.unknown().optional(),
});

export async function saveStyleProfile(input: { icons: string[]; notes: string; image_paths: string[]; prefs?: StylePrefs }): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in first." };
  const parsed = StyleProfileInput.safeParse(input);
  if (!parsed.success) return { error: "That style profile has something the app can't save." };
  const prefs = StylePrefsSchema.safeParse(parsed.data.prefs ?? {});
  if (!prefs.success) return { error: "One of those preferences isn't one the app knows. Refresh the page and try again." };
  const icons = parsed.data.icons.map((s) => s.trim().slice(0, 80)).filter(Boolean).slice(0, 12);
  const image_paths = parsed.data.image_paths.filter((p) => p.startsWith(`${user.id}/`)).slice(0, 12);
  const row = { user_id: user.id, icons, notes: parsed.data.notes.slice(0, 2000), image_paths, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("style_profiles").upsert({ ...row, prefs: prefs.data });
  if (!error) return {};
  const fallback = await supabase.from("style_profiles").upsert(row);
  if (fallback.error) return failed("save your style profile", fallback.error);
  return { error: "Saved your photos, icons and notes. To keep the preferences too, run supabase/migrations/20261016_style_profile_prefs.sql." };
}

export async function noteAppliedSuggestion(title: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const t = String(title ?? "").trim().slice(0, 120);
  if (!user || !t) return;
  const profile = await loadStyleProfile(supabase, user.id);
  const applied = [t, ...(profile?.applied ?? []).filter((x) => x !== t)].slice(0, 20);
  await supabase.from("style_profiles").upsert({ user_id: user.id, applied }, { onConflict: "user_id" });
}

export async function noteDismissedSuggestion(title: string): Promise<void> {
  const { supabase, user } = await requireUser();
  const t = String(title ?? "").trim().slice(0, 120);
  if (!user || !t) return;
  const profile = await loadStyleProfile(supabase, user.id);
  const dismissed = [t, ...(profile?.dismissed ?? []).filter((x) => x !== t)].slice(0, 20);
  await supabase.from("style_profiles").upsert({ user_id: user.id, dismissed }, { onConflict: "user_id" });
}

export async function loadChat(designId: string): Promise<ChatMessage[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase.from("design_chats").select("messages").eq("design_id", designId).maybeSingle();
  return normalizeChat(data?.messages);
}

export async function saveChat(designId: string, messages: unknown): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in first." };
  const { error } = await supabase.from("design_chats").upsert({ design_id: designId, owner: user.id, messages: normalizeChat(messages), updated_at: new Date().toISOString() });
  return error ? { error: "The conversation isn't being kept: run supabase/migrations/20261017_tracking_inventory_feedback.sql." } : {};
}

export async function setDesignStatus(id: string, status: Status): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in first." };
  const s = normalizeStatus(status);
  const { data, error } = await supabase.from("designs")
    .update({ status: s, made_at: s === "made" ? new Date().toISOString() : null })
    .eq("id", id).eq("owner", user.id).select("id");
  if (error) return { error: "Couldn't change the status: run supabase/migrations/20261017_tracking_inventory_feedback.sql." };
  if (!data?.length) return { error: "This design no longer exists." };
  revalidatePath("/rings"); revalidatePath("/inventory");
  return {};
}

export async function saveInventory(id: string, details: unknown, madeAt?: string | null): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in first." };
  const inventory = normalizeInventory(details);
  const made = madeAt && !Number.isNaN(Date.parse(madeAt)) ? new Date(madeAt).toISOString() : undefined;
  const { data, error } = await supabase.from("designs").update({ inventory, ...(made ? { made_at: made } : {}) }).eq("id", id).eq("owner", user.id).select("id");
  if (error) return failed("save the inventory details", error);
  if (!data?.length) return { error: "This design no longer exists." };
  revalidatePath("/inventory");
  return {};
}

export async function importDesigns(json: string): Promise<{ count?: number; skipped?: number; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in first." };
  const r = backupRows(json);
  if ("error" in r) return r;
  let { error } = await supabase.from("designs").insert(r.rows);
  if (error) ({ error } = await supabase.from("designs").insert(r.rows.map(({ data, name }) => ({ data, name }))));
  if (error) return failed("restore those designs", error);
  revalidatePath("/rings");
  return { count: r.rows.length, skipped: r.skipped };
}
