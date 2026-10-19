import { NextResponse } from "next/server";
import { z } from "zod";
import { drawFreeform, storageImages } from "@/lib/ai";
import { FreeformSchema } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";

export const runtime = "nodejs";
export const maxDuration = 300;

// Draws a freeform design from a description and/or photos, or changes one already drawn. The drawing is checked
// (stones overlapping, parts not joined) and, if anything is wrong, given back once to be fixed before it's returned.
const Body = z.object({
  type: z.enum(["necklace", "earrings", "ring"]),
  prompt: z.string().max(3000).optional(),
  paths: z.array(z.string()).max(4).default([]),
  current: FreeformSchema.optional(),
  change: z.string().max(1500).optional(),
  bandMm: z.number().min(1).max(12).optional(),
});

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to design a unique piece." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Describe the piece, add photos, or say what to change." }, { status: 400 });
  const { type, prompt, paths, current, change, bandMm } = body.data;
  if (!prompt && !paths.length && !(current && change)) return NextResponse.json({ error: "Describe the piece or add photos of it." }, { status: 400 });
  if (paths.some((p) => !p.startsWith(`${user.id}/`))) return NextResponse.json({ error: "Those files aren't yours." }, { status: 403 });
  const photos = paths.length ? await storageImages(supabase, "inspiration", paths) : [];
  if (paths.length && !photos.length) return NextResponse.json({ error: "Couldn't read the uploaded photos." }, { status: 400 });
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });

  try {
    const out = await drawFreeform({ type, images: photos, prompt, current, change, bandMm });
    if (!out) { await charge.refund(); return NextResponse.json({ error: "The design came back unusable. Try describing it more simply, or a clearer photo." }, { status: 502 }); }
    return NextResponse.json(out);
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "Designing the piece");
  }
}
