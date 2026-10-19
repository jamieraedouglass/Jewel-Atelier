import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { CHAT_SYSTEM, createMessage, createMotifTool, drawFreeform, proposeDesignTool, storageImages, toMotif, uniquePieceTool } from "@/lib/ai";
import { MOTIF_STYLE, designForAi, normalizeDesign } from "@/lib/design";
import { plainReply } from "@/lib/chat";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";
import { describeProfile, normalizePrefs } from "@/lib/style/profile";
import { loadStyleProfile, loadOwned, loadTaste } from "@/lib/style/load";
import { freshRead } from "@/lib/style/context";
import { droppedNote, screenProposals } from "@/lib/style/guard";
import type { StylePrefs } from "@/lib/style/profile";

export const runtime = "nodejs";
// A unique piece is drawn inside the reply, which can take a couple of minutes.
export const maxDuration = 300;

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
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });
  const design = normalizeDesign(body.data.design);

  const context: Anthropic.ContentBlockParam[] = [];
  let prefs: StylePrefs | null = null;
  if (useStyleProfile) {
    const [profile, taste, owned] = await Promise.all([loadStyleProfile(supabase, user.id), loadTaste(supabase, user.id), loadOwned(supabase, user.id)]);
    const useRead = !!profile && freshRead(profile);
    const imgs = profile && !useRead ? await storageImages(supabase, "inspiration", profile.image_paths.slice(0, 8)) : [];
    const text = describeProfile({
      prefs: profile?.prefs ?? normalizePrefs({}), icons: profile?.icons ?? [], notes: profile?.notes ?? "", taste,
      applied: profile?.applied, dismissed: profile?.dismissed, photos: imgs.length, photoRead: useRead ? profile.photoRead : "", owned,
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
    const latest = `${m.content}\n\n<current_design>${JSON.stringify(designForAi(design))}</current_design>`;
    return { role: "user", content: i === 0 ? [...context, { type: "text", text: latest }] : latest };
  });

  try {
    const msg = await createMessage({
      system: CHAT_SYSTEM,
      max_tokens: 4000,
      tools: [proposeDesignTool, createMotifTool, uniquePieceTool],
      messages: apiMessages,
    });
    const reply = plainReply(msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n"));
    const proposals = msg.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === proposeDesignTool.name)
      .map((b) => b.input as { title: string; why: string; patch: Record<string, unknown> });
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
    // Unique pieces: drawn, checked and fixed now, and offered as a sketch to apply.
    const asks = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === uniquePieceTool.name).slice(0, 1);
    for (const b of asks) {
      const input = b.input as { type?: string; brief?: string; change_current?: boolean };
      const type = input.type === "earrings" || input.type === "ring" ? input.type : "necklace";
      const changing = !!input.change_current && design.style === "freeform" && design.type === type;
      const drawn = await drawFreeform({
        type, images: [], bandMm: design.band.widthMm, timeLeftMs: 100_000,
        ...(changing ? { current: design.freeform, change: String(input.brief ?? "") } : { prompt: String(input.brief ?? "") }),
      });
      if (!drawn) continue;
      const left = drawn.issues.length ? ` Still to sort out: ${drawn.issues.join(" ")}` : "";
      proposals.push({
        title: `${changing ? "Changed" : "Unique piece"}: ${drawn.freeform.name}`,
        why: `${drawn.freeform.notes}${left}`.trim().slice(0, 1900),
        patch: { type, style: "freeform", freeform: drawn.freeform, ...(changing ? {} : { name: drawn.freeform.name }) },
      });
    }
    const { kept, dropped } = prefs ? screenProposals(proposals, prefs) : { kept: proposals, dropped: [] };
    const note = droppedNote(dropped);
    const sketched = kept.some((p) => p.patch.style === "freeform");
    const text = [reply || (sketched ? "Here's a sketch of it. Apply it to build it in 3D, or tell me what to change." : kept.length ? "Here's what I'd try:" : ""), note].filter(Boolean).join("\n\n");
    return NextResponse.json({ reply: text, proposals: kept });
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "The designer chat");
  }
}
