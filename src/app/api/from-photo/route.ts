import { NextResponse } from "next/server";
import { z } from "zod";
import { callTool, RECREATE_SYSTEM, recreateDesignTool, storageImages } from "@/lib/claude";
import { STYLES, TYPES } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";
import { profileText } from "@/lib/style/context";

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

  // read the uploads first, so a bad upload doesn't use up one of today's AI requests
  const images = await storageImages(supabase, "inspiration", paths);
  if (!images.length) return NextResponse.json({ error: "Couldn't read the uploaded photos." }, { status: 400 });
  // a failed or unusable reply gives the call back
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });

  try {
    const profile = await profileText(supabase, user.id);
    const text = [
      images.length > 1 ? `${images.length} photos of the same piece.` : "A photo of the piece.",
      notes ? `Notes: ${notes}` : null,
      // the photo decides the piece; the profile only fills in what the photo can't show (metal tone, karat, sizes)
      profile ? `Use this only for what the photo can't show, such as karat, an unclear metal, and sizes:\n${profile}` : null,
    ].filter(Boolean).join("\n");
    const input = await callTool({ system: RECREATE_SYSTEM, tool: recreateDesignTool, maxTokens: 4000, content: [...images, { type: "text", text }] });
    const r = Result.safeParse(input);
    if (!r.success) { await charge.refund(); return NextResponse.json({ error: "Couldn't read the piece clearly. Try a closer, brighter photo." }, { status: 502 }); }
    const d = r.data;
    const style = Object.hasOwn(STYLES[d.type], d.style) ? d.style : Object.keys(STYLES[d.type])[0];
    return NextResponse.json({ title: d.title.slice(0, 80), type: d.type, style, patch: d.patch, description: d.description, notModelled: d.not_modelled.slice(0, 8) });
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "Recreating the piece");
  }
}
