import { NextResponse } from "next/server";
import { z } from "zod";
import { jpegImage, refineFromRender, storageImages } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";

export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({
  paths: z.array(z.string()).min(1).max(4),
  notes: z.string().max(3000).optional(),
  design: z.unknown(),
  render: z.string().startsWith("data:image/jpeg;base64,").max(3_000_000),
  round: z.number().int().min(1).max(3),
  request: z.string().max(3000).optional(),
});

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to recreate a piece from a photo." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { paths, notes, render, round, design, request } = body.data;
  if (paths.some((p) => !p.startsWith(`${user.id}/`))) return NextResponse.json({ error: "Those files aren't yours." }, { status: 403 });

  const photos = await storageImages(supabase, "inspiration", paths);
  if (!photos.length) return NextResponse.json({ error: "Couldn't read the uploaded photos." }, { status: 400 });
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });

  try {
    const result = await refineFromRender(photos, jpegImage(render), design, round, notes, request);
    if (!result) { await charge.refund(); return NextResponse.json({ error: "Couldn't compare the build with the photo." }, { status: 502 }); }
    return NextResponse.json(result);
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "Checking the recreation");
  }
}
