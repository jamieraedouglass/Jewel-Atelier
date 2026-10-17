import { z } from "zod";

/** A conversation with the design consultant, as kept with each saved design. */

export const ProposalSchema = z.object({
  title: z.string().max(200),
  why: z.string().max(2000).default(""),
  patch: z.record(z.unknown()),
  /** a heads-up from the avoid check, e.g. a metal they don't wear */
  note: z.string().max(300).optional(),
  /** what they did with it */
  state: z.enum(["applied", "dismissed"]).optional(),
});
export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
  proposals: z.array(ProposalSchema).max(8).optional(),
});
export type ChatProposal = z.infer<typeof ProposalSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** the most a design keeps; older messages fall off the front */
export const KEEP_MESSAGES = 60;

/** a stored conversation from anything; unreadable messages are dropped rather than losing the lot */
export function normalizeChat(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((m) => { const r = ChatMessageSchema.safeParse(m); return r.success ? [r.data] : []; }).slice(-KEEP_MESSAGES);
}

const describePatch = (p: Record<string, unknown>): string => {
  const parts: string[] = [];
  const walk = (o: Record<string, unknown>, prefix = "") => {
    for (const [k, v] of Object.entries(o)) {
      if (k === "motif" && v && typeof v === "object") { parts.push(`motif: ${(v as { name?: string }).name ?? "custom"}`); continue; }
      if (v && typeof v === "object") walk(v as Record<string, unknown>, `${prefix}${k} `);
      else parts.push(`${prefix}${k}: ${typeof v === "number" ? Math.round(v * 100) / 100 : String(v)}`);
    }
  };
  walk(p);
  return parts.join(" · ");
};
export { describePatch };

/**
 * The conversation as the chat API takes it: at most `max` messages, starting with one of theirs, with each suggestion
 * (and what they did with it) folded into the text so the consultant remembers.
 */
export function chatForApi(messages: ChatMessage[], max = 40, describe: (p: ChatProposal) => string = (p) => describePatch(p.patch)) {
  let tail = messages.slice(-max);
  while (tail.length && tail[0].role !== "user") tail = tail.slice(1);
  return tail.map((m) => ({
    role: m.role,
    content: m.proposals?.length
      ? `${m.content}\n${m.proposals.map((p) => `[Suggested: ${p.title} — ${describe(p)}${p.state === "applied" ? " (they applied it)" : p.state === "dismissed" ? " (they turned it down)" : ""}]`).join("\n")}`
      : m.content,
  }));
}

/** a reply as the chat shows it: plain text (the chat doesn't render markdown, so **bold** and # headings show as symbols) */
export const plainReply = (text: string) =>
  text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/^\s*[*]\s+/gm, "• ").trim();
