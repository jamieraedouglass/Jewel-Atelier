import { NextResponse } from "next/server";
import { z } from "zod";
import { jpegImage, recreateFromPhotos, refineFromRender } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  photos: z.array(z.string().startsWith("data:image/jpeg;base64,")).min(1).max(4),
  notes: z.string().max(1000).optional(),
  design: z.unknown().optional(),
  render: z.string().startsWith("data:image/jpeg;base64,").optional(),
  round: z.number().int().min(1).max(5).optional(),
});

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const { photos, notes, design, render, round } = body.data;
  const images = photos.map(jpegImage);
  const result = render ? await refineFromRender(images, jpegImage(render), design, round ?? 1, notes) : await recreateFromPhotos(images, notes);
  return result ? NextResponse.json(result) : NextResponse.json({ error: "No usable reply." }, { status: 502 });
}
