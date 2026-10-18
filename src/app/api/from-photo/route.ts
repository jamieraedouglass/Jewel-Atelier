import { NextResponse } from "next/server";
import { z } from "zod";
import { recreateFromPhotos, storageImages } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";
import { profileText } from "@/lib/style/context";

export const runtime = "nodejs";
export const maxDuration = 90;

const Body = z.object({ paths: z.array(z.string()).min(1).max(4), notes: z.string().max(3000).optional() });

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to recreate a piece from a photo." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    const tooLong = body.error.issues.some((i) => i.path[0] === "notes");
    return NextResponse.json({ error: tooLong ? "The notes are too long: keep them under 3,000 characters." : "Send 1–4 uploaded photos." }, { status: 400 });
  }
  const { paths, notes } = body.data;
  if (paths.some((p) => !p.startsWith(`${user.id}/`))) return NextResponse.json({ error: "Those files aren't yours." }, { status: 403 });

  const images = await storageImages(supabase, "inspiration", paths);
  if (!images.length) return NextResponse.json({ error: "Couldn't read the uploaded photos." }, { status: 400 });
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });

  try {
    const result = await recreateFromPhotos(images, notes, (await profileText(supabase, user.id)) || undefined);
    if (!result) { await charge.refund(); return NextResponse.json({ error: "Couldn't read the piece clearly. Try a closer, brighter photo." }, { status: 502 }); }
    return NextResponse.json(result);
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "Recreating the piece");
  }
}
