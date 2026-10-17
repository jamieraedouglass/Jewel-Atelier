import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL, proposeDesignTool } from "@/lib/claude";
import { applyPatchLenient, designForAi, normalizeDesign, type DesignPatch } from "@/lib/design";
import { normalizeChat, plainReply } from "@/lib/chat";
import { aiFailure } from "@/lib/apiError";
import { BRAND } from "@/lib/brand";
import { clientChatSystem, isPriceQuestion, mentionsMoney, priceReply } from "@/lib/studio/clientChat";
import { rupeeRate } from "@/lib/studio/fx";
import { knownPriceReply, priceFor } from "@/lib/studio/pricing";
import { allowText, clampToAllowed } from "@/lib/studio/links";
import { loadClientBundle, recordEvent, refundLinkAiCall, saveClientChat, spendLinkAiCall } from "@/lib/studio/server";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  designId: z.string().uuid(),
  design: z.unknown(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(8000) })).min(1).max(40),
  /** the whole conversation as shown, kept with the client's copy */
  history: z.unknown().optional(),
});

/**
 * The design consultant on a client link: it may only suggest what the jeweller allowed, each suggestion arrives as
 * a finished, already-checked design, and the link's own daily allowance limits use. It never prices anything: a price
 * question goes to the jeweller without asking the AI (and without using up the allowance).
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
  const question = messages[messages.length - 1].content;
  const history = normalizeChat(body.data.history);
  const current = clampToAllowed(piece.base, normalizeDesign(body.data.design), bundle.allow);
  if (messages[messages.length - 1].role === "user" && isPriceQuestion(question)) {
    // the jeweller's own price when the piece is one he priced (never the AI's); otherwise it goes to him
    const match = priceFor(piece.base, current, bundle.pricing.pieces[piece.designId]);
    const { currency } = bundle.pricing;
    const reply = match ? knownPriceReply(BRAND.studioName, piece.name, match.inr, currency, await rupeeRate(currency)) : priceReply(BRAND.studioName);
    await recordEvent(bundle.link.id, piece.designId, "asked-price", { question: question.slice(0, 300), ...(match ? { shownInr: match.inr } : {}) });
    await saveClientChat(bundle, piece.designId, [...history, { role: "assistant", content: reply }]);
    return NextResponse.json({ reply, proposals: [] });
  }
  if (!(await spendLinkAiCall(bundle.link))) return NextResponse.json({ error: "The designer has answered all it can for today. Use Ask the jeweller, or try again tomorrow." }, { status: 429 });

  const apiMessages: Anthropic.MessageParam[] = messages.map((m, i) =>
    i === messages.length - 1 && m.role === "user"
      ? { role: "user", content: `${m.content}\n\n<current_design>${JSON.stringify(designForAi(current))}</current_design>` }
      : { role: m.role, content: m.content });
  try {
    const msg = await anthropic().messages.create({
      model: MODEL, max_tokens: 2000,
      system: `${clientChatSystem(BRAND.studioName, bundle.link.client_name, bundle.link.note)}\n${allowText(bundle.allow, piece.base)}`,
      tools: [proposeDesignTool], messages: apiMessages,
    });
    const text = plainReply(msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n"));
    // the last word on prices: if one slipped through, the client gets the standard answer instead
    const reply = mentionsMoney(text) ? priceReply(BRAND.studioName) : text;
    // each suggestion becomes the finished design it would give, kept within what's allowed; no-ops are dropped
    const proposals = msg.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === proposeDesignTool.name)
      .map((b) => b.input as { title: string; why: string; patch: DesignPatch })
      .map((p) => ({ title: p.title, why: p.why, design: clampToAllowed(piece.base, applyPatchLenient(current, p.patch ?? {}), bundle.allow) }))
      .filter((p) => JSON.stringify(p.design) !== JSON.stringify(current) && !mentionsMoney(`${p.title} ${p.why}`));
    await recordEvent(bundle.link.id, piece.designId, "asked-designer", { question: question.slice(0, 300) });
    await saveClientChat(bundle, piece.designId, [...history, { role: "assistant", content: reply || "…" }]);
    return NextResponse.json({ reply: reply || (proposals.length ? "Here's what I'd suggest:" : ""), proposals });
  } catch (e) {
    // the client shouldn't lose one of the day's questions to an AI that didn't answer
    await refundLinkAiCall(bundle.link).catch(() => {});
    return aiFailure(e, "The designer chat");
  }
}
