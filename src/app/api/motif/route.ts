import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic, createMotifTool, MODEL, MOTIF_SYSTEM, storageImages, toMotif } from "@/lib/claude";
import { requireUser } from "@/lib/supabase/server";
import { spendAiCall } from "@/lib/usage";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  prompt: z.string().max(1500).optional(),
  imagePath: z.string().optional(),
  pieceType: z.string().max(30).optional(),
});

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to create motifs." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success || (!body.data.prompt && !body.data.imagePath)) return NextResponse.json({ error: "Describe the motif or upload a sketch." }, { status: 400 });
  const { prompt, imagePath, pieceType } = body.data;
  if (imagePath && !imagePath.startsWith(`${user.id}/`)) return NextResponse.json({ error: "That file isn't yours." }, { status: 403 });
  const limited = await spendAiCall(supabase);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });

  const images = imagePath ? await storageImages(supabase, "stones", [imagePath]) : [];
  const text = [
    images.length ? "Trace this sketch or photo into a motif." : null,
    prompt ? `Brief: ${prompt}` : null,
    pieceType ? `It will be used on: ${pieceType}.` : null,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: MOTIF_SYSTEM,
      tools: [createMotifTool],
      tool_choice: { type: "tool", name: createMotifTool.name },
      messages: [{ role: "user", content: [...images, { type: "text", text }] }],
    });
    const call = msg.content.find((b) => b.type === "tool_use");
    const result = call && "input" in call ? toMotif(call.input) : null;
    if (!result) return NextResponse.json({ error: "The drawing came back unusable. Try a simpler description or a clearer sketch." }, { status: 502 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Motif generation failed." }, { status: 500 });
  }
}
