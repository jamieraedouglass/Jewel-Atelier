import { NextResponse } from "next/server";
import { z } from "zod";
import { callTool, createMotifTool, MOTIF_SYSTEM, storageImages, toMotif } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";
import { profileText } from "@/lib/style/context";

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
  const images = imagePath ? await storageImages(supabase, "stones", [imagePath]) : [];
  if (imagePath && !images.length) return NextResponse.json({ error: "Couldn't read the uploaded sketch." }, { status: 400 });
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });
  const profile = await profileText(supabase, user.id);
  const text = [
    images.length ? "Trace this sketch or photo into a motif." : null,
    prompt ? `Brief: ${prompt}` : null,
    pieceType ? `It will be used on: ${pieceType}.` : null,
    profile ? `Draw it in a way that suits this person:\n${profile}` : null,
  ].filter(Boolean).join("\n");

  try {
    const input = await callTool({ system: MOTIF_SYSTEM, tool: createMotifTool, content: [...images, { type: "text", text }], maxTokens: 4000 });
    const result = input ? toMotif(input) : null;
    if (!result) { await charge.refund(); return NextResponse.json({ error: "The drawing came back unusable. Try a simpler description or a clearer sketch." }, { status: 502 }); }
    return NextResponse.json(result);
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "Drawing the motif");
  }
}
