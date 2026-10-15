import { NextResponse } from "next/server";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { anthropic, CHAT_SYSTEM, MODEL, proposeDesignTool, storageImages } from "@/lib/claude";
import { normalizeDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { spendAiCall } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).min(1).max(40),
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
  const limited = await spendAiCall(supabase);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const design = normalizeDesign(body.data.design);

  // Style context goes at the front of the first user turn and is cached across the conversation.
  const context: Anthropic.ContentBlockParam[] = [];
  if (useStyleProfile) {
    const { data: profile } = await supabase.from("style_profiles").select("icons, notes, image_paths").eq("user_id", user.id).maybeSingle();
    if (profile) {
      const imgs = await storageImages(supabase, "inspiration", (profile.image_paths ?? []).slice(0, 8));
      context.push(...imgs);
      context.push({
        type: "text",
        text: [
          "STYLE PROFILE",
          imgs.length ? `The ${imgs.length} image(s) above are this person's inspiration photos.` : "No inspiration photos yet.",
          profile.icons?.length ? `Style icons: ${profile.icons.join(", ")}.` : null,
          profile.notes ? `Their notes: ${profile.notes}` : null,
        ].filter(Boolean).join("\n"),
        cache_control: { type: "ephemeral" },
      });
    }
  }

  const apiMessages: Anthropic.MessageParam[] = messages.map((m, i) => {
    if (i !== messages.length - 1 || m.role !== "user") {
      if (i === 0) return { role: "user", content: [...context, { type: "text", text: m.content }] };
      return { role: m.role, content: m.content };
    }
    const latest = `${m.content}\n\n<current_design>${JSON.stringify(design)}</current_design>`;
    return { role: "user", content: i === 0 ? [...context, { type: "text", text: latest }] : latest };
  });

  try {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1000,
      system: CHAT_SYSTEM,
      tools: [proposeDesignTool],
      messages: apiMessages,
    });
    const reply = msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
    const proposals = msg.content
      .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === proposeDesignTool.name)
      .map((b) => b.input as { title: string; why: string; patch: Record<string, unknown> });
    return NextResponse.json({ reply: reply || (proposals.length ? "Here's what I'd try:" : ""), proposals });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Chat failed." }, { status: 500 });
  }
}
