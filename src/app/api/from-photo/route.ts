import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic, MODEL, RECREATE_SYSTEM, recreateDesignTool, storageImages } from "@/lib/claude";
import { STYLES, TYPES } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { spendAiCall } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({ paths: z.array(z.string()).min(1).max(4), notes: z.string().max(1000).optional() });
const Result = z.object({
  title: z.string(), type: z.enum(TYPES), style: z.string(), patch: z.record(z.unknown()),
  description: z.string(), not_modelled: z.array(z.string()).default([]),
});

/** Photo of a finished piece → the closest editable design. */
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to recreate a piece from a photo." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Send 1–4 uploaded photos." }, { status: 400 });
  const { paths, notes } = body.data;
  if (paths.some((p) => !p.startsWith(`${user.id}/`))) return NextResponse.json({ error: "Those files aren't yours." }, { status: 403 });

  const limited = await spendAiCall(supabase);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const images = await storageImages(supabase, "inspiration", paths);
  if (!images.length) return NextResponse.json({ error: "Couldn't read the uploaded photos." }, { status: 400 });

  try {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: RECREATE_SYSTEM,
      tools: [recreateDesignTool],
      tool_choice: { type: "tool", name: recreateDesignTool.name },
      messages: [{ role: "user", content: [...images, { type: "text", text: [images.length > 1 ? `${images.length} photos of the same piece.` : "A photo of the piece.", notes ? `Notes: ${notes}` : null].filter(Boolean).join("\n") }] }],
    });
    const call = msg.content.find((b) => b.type === "tool_use");
    const r = Result.safeParse(call && "input" in call ? call.input : null);
    if (!r.success) return NextResponse.json({ error: "Couldn't read the piece clearly. Try a closer, brighter photo." }, { status: 502 });
    const d = r.data;
    const style = STYLES[d.type][d.style] ? d.style : Object.keys(STYLES[d.type])[0];
    return NextResponse.json({ title: d.title.slice(0, 80), type: d.type, style, patch: d.patch, description: d.description, notModelled: d.not_modelled.slice(0, 8) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't recreate the piece." }, { status: 500 });
  }
}
