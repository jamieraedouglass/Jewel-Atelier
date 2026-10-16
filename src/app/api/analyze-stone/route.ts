import { NextResponse } from "next/server";
import { z } from "zod";
import { callTool, STONE_SYSTEM, stoneAnalysisTool, storageImages } from "@/lib/claude";
import { CUTS, GEMS, SHAPES, estimateDims, type CenterStone, diamondGrade } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";
import { profileText } from "@/lib/style/context";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  paths: z.array(z.string()).min(1).max(6),
  carat: z.number().positive().max(60).nullable().optional(),
  notes: z.string().max(1000).optional(),
});

const Analysis = z.object({
  gem: z.enum(GEMS),
  cut: z.enum(CUTS),
  shape: z.enum(SHAPES),
  color_hex: z.string(),
  clarity: z.number(),
  // "leave empty" can arrive as null as well as missing
  length_mm: z.number().nullish(),
  width_mm: z.number().nullish(),
  dome_mm: z.number().nullish(),
  size_basis: z.enum(["scale reference", "carat weight", "guess"]),
  label: z.string(),
  observations: z.string(),
  cautions: z.array(z.string()),
  confidence: z.number(),
  pairing: z.string().nullish(),
  diamond_color: z.string().nullish(),
  inclusions: z.number().nullish(),
  inclusion_notes: z.string().nullish(),
  phenomenon: z.string().nullish(),
  star_rays: z.number().nullish(),
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to analyse stones." }, { status: 401 });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Send 1–6 uploaded image paths." }, { status: 400 });
  const { paths, carat, notes } = body.data;
  if (paths.some((p) => !p.startsWith(`${user.id}/`))) return NextResponse.json({ error: "Those files aren't yours." }, { status: 403 });

  // read the uploads first, so a bad upload doesn't use up one of today's AI requests
  const images = await storageImages(supabase, "stones", paths);
  if (!images.length) return NextResponse.json({ error: "Couldn't read the uploaded images." }, { status: 400 });
  // a failed or unusable reply gives the call back
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });

  const profile = await profileText(supabase, user.id);
  const text = [
    images.length > 1 ? `These are ${images.length} frames of the same stone.` : "This is a photo of the stone.",
    carat ? `Stated carat weight: ${carat} ct.` : null,
    notes ? `Notes from the person: ${notes}` : null,
    profile ? `Their style profile, for the pairing suggestion only:\n${profile}` : null,
  ].filter(Boolean).join("\n");

  try {
    const input = await callTool({ system: STONE_SYSTEM, tool: stoneAnalysisTool, content: [...images, { type: "text", text }], maxTokens: 1200 });
    const parsed = Analysis.safeParse(input);
    if (!parsed.success) { await charge.refund(); return NextResponse.json({ error: "The analysis came back incomplete. Try a clearer photo." }, { status: 502 }); }
    const a = parsed.data;

    let dims = { lengthMm: a.length_mm ?? 10, widthMm: a.width_mm ?? 8, domeMm: a.dome_mm ?? 3 };
    if (carat && a.size_basis !== "scale reference") dims = estimateDims(a.gem, a.cut, a.shape, carat);

    const grade = diamondGrade(a.diamond_color);
    // a star or cat's eye only shows on a cabochon
    const effect = (a.phenomenon === "star" || a.phenomenon === "cats-eye") && (a.cut === "cabochon" || a.cut === "carved") ? a.phenomenon : "none";
    const stone: Partial<CenterStone> = {
      gem: a.gem,
      cut: a.cut,
      shape: a.shape,
      carat: carat ?? null,
      lengthMm: clamp(dims.lengthMm, 2, 30),
      widthMm: clamp(dims.widthMm, 2, 30),
      domeMm: clamp(dims.domeMm, 0.5, 15),
      // a diamond's colour comes from its grade: photo white balance makes the raw colour unreliable for near-white stones
      color: grade && a.gem === "diamond" ? grade.color : /^#[0-9a-f]{6}$/i.test(a.color_hex) ? a.color_hex : "#0c2394",
      colorGrade: grade && a.gem === "diamond" ? grade.id : null,
      inclusions: clamp(a.inclusions ?? 0, 0, 1),
      phenomenon: effect,
      rays: (a.star_rays === 4 || a.star_rays === 12 ? a.star_rays : 6) as 4 | 6 | 12,
      clarity: clamp(a.clarity, 0, 1),
      label: a.label.slice(0, 120),
      photoPath: paths[0],
    };
    const character = [a.inclusion_notes && !/^none/i.test(a.inclusion_notes) ? a.inclusion_notes : null, a.phenomenon === "colour-change" ? "Shows a colour change between lights (not drawn in 3D)." : null].filter(Boolean).join(" ");
    return NextResponse.json({ stone, analysis: { observations: character ? `${a.observations} ${character}` : a.observations, cautions: a.cautions, confidence: a.confidence, pairing: a.pairing ?? null, sizeBasis: carat && a.size_basis !== "scale reference" ? "carat weight" : a.size_basis } });
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "Stone analysis");
  }
}
