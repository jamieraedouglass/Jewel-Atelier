import { linkState } from "./links";

/** The studio dashboard's numbers and sentences, from links and their events (shared by the real studio and the demo). */

export type DashLink = { id: string; client_name: string; design_ids: string[]; created_at: string; last_opened_at: string | null; expires_at: string | null; revoked: boolean };
export type DashEvent = { id: number | string; link_id: string; design_id: string | null; kind: string; detail: Record<string, unknown>; at: string };

/** what a client sends the jeweller's way: a message, or a price question the assistant passed on */
const FOR_YOU = new Set(["asked-jeweller", "asked-price"]);

export function eventText(e: Pick<DashEvent, "kind" | "detail">, pieceName: string | null): string {
  const on = pieceName ? ` ${pieceName}` : "";
  switch (e.kind) {
    case "opened": return "opened the link";
    case "changed": {
      const changes = Array.isArray(e.detail.changes) ? (e.detail.changes as string[]) : [];
      return changes.length ? `changed${on}: ${changes.join("; ")}` : `went back to the original${on}`;
    }
    case "tried-on": return pieceName ? `tried on${on}` : "tried the pieces on together";
    case "compared": return "compared pieces side by side";
    case "asked-designer": return `asked the design assistant about${on}: "${String(e.detail.question ?? "")}"`;
    case "asked-price": return `asked for a price${pieceName ? ` on${on}` : ""}: "${String(e.detail.question ?? "")}"`;
    case "asked-jeweller": return `wrote to you${pieceName ? ` about${on}` : ""}: "${String(e.detail.message ?? "")}"`;
    default: return e.kind;
  }
}

export function studioSummary(links: DashLink[], events: DashEvent[], pieceNames: Record<string, string>, now = Date.now()) {
  const week = now - 7 * 86_400_000;
  const byLink = new Map<string, DashEvent[]>();
  for (const e of events) byLink.set(e.link_id, [...(byLink.get(e.link_id) ?? []), e]);
  const client = (id: string) => links.find((l) => l.id === id)?.client_name ?? "A client";
  const rows = links.map((l) => {
    const ev = byLink.get(l.id) ?? [];
    return {
      id: l.id, clientName: l.client_name, pieces: l.design_ids.map((d) => pieceNames[d] ?? "A piece"), state: linkState(l, now),
      createdAt: l.created_at, lastOpenedAt: l.last_opened_at,
      opens: ev.filter((e) => e.kind === "opened").length,
      changes: ev.filter((e) => e.kind === "changed").length,
      questions: ev.filter((e) => e.kind === "asked-designer" || e.kind === "asked-price" || e.kind === "asked-jeweller").length,
      waiting: ev.some((e) => FOR_YOU.has(e.kind)),
    };
  });
  const feed = events.slice().sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).map((e) => ({
    id: e.id, at: e.at, linkId: e.link_id, kind: e.kind,
    text: `${client(e.link_id)} ${eventText(e, e.design_id ? pieceNames[e.design_id] ?? "a piece" : null)}`,
  }));
  const attention = new Map<string, number>();
  for (const e of events) if (e.design_id && e.kind !== "opened") attention.set(e.design_id, (attention.get(e.design_id) ?? 0) + 1);
  return {
    tiles: {
      activeLinks: rows.filter((r) => r.state === "active").length,
      openedThisWeek: new Set(events.filter((e) => e.kind === "opened" && Date.parse(e.at) >= week).map((e) => e.link_id)).size,
      messages: events.filter((e) => FOR_YOU.has(e.kind)).length,
      designerQuestions: events.filter((e) => e.kind === "asked-designer").length,
    },
    links: rows,
    needsYou: feed.filter((f) => FOR_YOU.has(f.kind)),
    feed: feed.slice(0, 60),
    mostViewed: [...attention].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([id, n]) => ({ name: pieceNames[id] ?? "A piece", interactions: n })),
  };
}
export type StudioSummary = ReturnType<typeof studioSummary>;
