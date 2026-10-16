import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CHAT_SYSTEM, MODEL, proposeDesignTool } from "@/lib/claude";
import { applyPatchLenient, normalizeDesign, type DesignPatch } from "@/lib/design";
import { normalizeChat } from "@/lib/chat";
import { aiFailure } from "@/lib/apiError";
import { allowText, clampToAllowed } from "@/lib/studio/links";
import { loadClientBundle, recordEvent, saveClientChat, spendLinkAiCall } from "@/lib/studio/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  designId: z.string().uuid(),
  design: z.unknown(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) })).min(1).max(40),
  /** the whole conversation as shown, kept with the client's copy */
  history: z.unknown().optional(),
});

/**
 * The design consultant on a client link: it may only suggest what the jeweller allowed, each suggestion arrives as
 * a finished, already-checked design, and the link's own daily allowance limits use.
 */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const bundle = await loadClientBundle(params.token);
  if (!bundle) return NextResponse.json({ error: "This link doesn't exist." }, { status: 404 });
  if (bundle.state !== "active") return NextResponse.json({ error: "This link has expired. Ask the jeweller for a new one." }, { status: 410 });
  if (!bundle.allow.chat) return NextResponse.json({ error: "The designer chat is switched off for this link." }, { status: 403 });
  const piece = bundle.pieces.find((p) => p.designId === body.data.designId);
  if (!piece) return NextResponse.json({ error: "That piece isn't in this link." }, { status: 404 });
  const { messages } = body.data;
  if (messages[0].role !== "user") return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (!(await spendLinkAiCall(bundle.link))) return NextResponse.json({ error: "The designer has answered all it can for today. Use Ask the jeweller, or try again tomorrow." }, { status: 429 });

  const current = clampToAllowed(piece.base, normalizeDesign(body.data.design), bundle.allow);
  const apiMessages: Anthropic.MessageParam[] = messages.map((m, i) =>
    i === messages.length - 1 && m.role === "user"
      ? { role: "user", content: `${m.content}\n\n<current_design>${JSON.stringify(current)}</current_design>` }
      : { role: m.role, content: m.content });
  try {
    const msg = await anthropic().messages.create({
      model: MODEL, max_tokens: 2000,
      system: `${CHAT_SYSTEM}\n\n${allowText(bundle.allow, piece.base)}`,
      tools: [proposeDesignTool], messages: apiMessages,
    });
    const reply = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    // each suggestion becomes the finished design it would give, kept within what's allowed; no-ops are dropped
    const proposals = msg.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === proposeDesignTool.name)
      .map((b) => b.input as { title: string; why: string; patch: DesignPatch })
      .map((p) => ({ title: p.title, why: p.why, design: clampToAllowed(piece.base, applyPatchLenient(current, p.patch ?? {}), bundle.allow) }))
      .filter((p) => JSON.stringify(p.design) !== JSON.stringify(current));
    await recordEvent(bundle.link.id, piece.designId, "asked-designer", { question: messages[messages.length - 1].content.slice(0, 300) });
    const history = normalizeChat(body.data.history);
    await saveClientChat(bundle, piece.designId, [...history, { role: "assistant", content: reply || "…" }]);
    return NextResponse.json({ reply: reply || (proposals.length ? "Here's what I'd suggest:" : ""), proposals });
  } catch (e) {
    return aiFailure(e, "The designer chat");
  }
}
