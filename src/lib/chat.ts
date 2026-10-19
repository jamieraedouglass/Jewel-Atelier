import { z } from "zod";

const ProposalSchema = z.object({
  title: z.string().max(200),
  why: z.string().max(2000).default(""),
  patch: z.record(z.unknown()),
  note: z.string().max(300).optional(),
  state: z.enum(["applied", "dismissed"]).optional(),
});
const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8000),
  proposals: z.array(ProposalSchema).max(8).optional(),
});
export type ChatProposal = z.infer<typeof ProposalSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const KEEP_MESSAGES = 60;

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

export const plainReply = (text: string) =>
  text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/__(.+?)__/g, "$1").replace(/^#{1,6}\s+/gm, "").replace(/^\s*[*]\s+/gm, "• ").trim();
