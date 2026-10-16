import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CHAT_SYSTEM, createMotifTool, MODEL, proposeDesignTool, storageImages, toMotif } from "@/lib/claude";
import { MOTIF_STYLE, designForAi, normalizeDesign } from "@/lib/design";
import { plainReply } from "@/lib/chat";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";
import { describeProfile, normalizePrefs } from "@/lib/style/profile";
import { loadStyleProfile, loadTaste } from "@/lib/style/load";
import { freshRead } from "@/lib/style/context";
import { droppedNote, screenProposals } from "@/lib/style/guard";
import type { StylePrefs } from "@/lib/style/profile";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(4000) })).min(1).max(40),
  design: z.unknown(),
  useStyleProfile: z.boolean().default(true),
});

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to chat with the designer." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { messages, useStyleProfile } = body.data;
  if (messages[0].role !== "user") return NextResponse.json({ error: "Conversation must start with you." }, { status: 400 });
  // a failed or unusable reply gives the call back
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });
  const design = normalizeDesign(body.data.design);

  // Style context goes at the front of the first user turn and is cached across the conversation.
  const context: Anthropic.ContentBlockParam[] = [];
  let prefs: StylePrefs | null = null;
  if (useStyleProfile) {
    const [profile, taste] = await Promise.all([loadStyleProfile(supabase, user.id), loadTaste(supabase, user.id)]);
    // the written read of their photos when it is up to date (cheaper and faster); otherwise the photos themselves
    const useRead = !!profile && freshRead(profile);
    const imgs = profile && !useRead ? await storageImages(supabase, "inspiration", profile.image_paths.slice(0, 8)) : [];
    const text = describeProfile({
      prefs: profile?.prefs ?? normalizePrefs({}), icons: profile?.icons ?? [], notes: profile?.notes ?? "", taste,
      applied: profile?.applied, dismissed: profile?.dismissed, photos: imgs.length, photoRead: useRead ? profile.photoRead : "",
    });
    prefs = profile?.prefs ?? null;
    if (text) {
      context.push(...imgs);
      context.push({ type: "text", text, cache_control: { type: "ephemeral" } });
    }
  }

  const apiMessages: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (i !== messages.length - 1 || m.role !== "user") {
      if (i === 0) return { role: "user", content: [...context, { type: "text", text: m.content }] };
      return { role: m.role, content: m.content };
    }
    // only the parts this piece has (settings for unused parts would read as stones that aren't there)
    const latest = `${m.content}\n\n<current_design>${JSON.stringify(designForAi(design))}</current_design>`;
    return { role: "user", content: i === 0 ? [...context, { type: "text", text: latest }] : latest };
  });

  try {
    const msg = await anthropic().messages.create({
      model: MODEL,
      system: CHAT_SYSTEM,
      max_tokens: 4000,
      tools: [proposeDesignTool, createMotifTool],
      messages: apiMessages,
    });
    const reply = plainReply(msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n"));
    const proposals = msg.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === proposeDesignTool.name)
      .map((b) => b.input as { title: string; why: string; patch: Record<string, unknown> });
    // a new motif becomes a one-click proposal that also switches to that type's motif style
    for (const b of msg.content) {
      if (b.type !== "tool_use" || b.name !== createMotifTool.name) continue;
      const r = toMotif(b.input);
      if (!r) continue;
      const style = MOTIF_STYLE[design.type];
      proposals.push({
        title: `New motif: ${r.motif.name}`,
        why: r.notes,
        patch: { ...(style ? { style } : { type: "necklace", style: "motif-pendant" }), motif: r.motif, ...(r.enamel ? { enamel: { enabled: true } } : {}) },
      });
    }
    // make sure nothing they said to avoid gets through, whatever the model did
    const { kept, dropped } = prefs ? screenProposals(proposals, prefs) : { kept: proposals, dropped: [] };
    const note = droppedNote(dropped);
    const text = [reply || (kept.length ? "Here's what I'd try:" : ""), note].filter(Boolean).join("\n\n");
    return NextResponse.json({ reply: text, proposals: kept });
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "The designer chat");
  }
}
