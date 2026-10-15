import { NextResponse } from "next/server";
import { z } from "zod";
import { anthropic, MODEL, STONE_SYSTEM, stoneAnalysisTool, storageImages } from "@/lib/claude";
import { CUTS, GEMS, SHAPES, estimateDims, type CenterStone } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { spendAiCall } from "@/lib/usage";

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
  length_mm: z.number().optional(),
  width_mm: z.number().optional(),
  dome_mm: z.number().optional(),
  size_basis: z.enum(["scale reference", "carat weight", "guess"]),
  label: z.string(),
  observations: z.string(),
  cautions: z.array(z.string()),
  confidence: z.number(),
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to analyse stones." }, { status: 401 });

  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Send 1–6 uploaded image paths." }, { status: 400 });
  const { paths, carat, notes } = body.data;
  if (paths.some((p) => !p.startsWith(`${user.id}/`))) return NextResponse.json({ error: "Those files aren't yours." }, { status: 403 });

  const limited = await spendAiCall(supabase);
  if (limited) return NextResponse.json({ error: limited }, { status: 429 });
  const images = await storageImages(supabase, "stones", paths);
  if (!images.length) return NextResponse.json({ error: "Couldn't read the uploaded images." }, { status: 400 });

  const text = [
    images.length > 1 ? `These are ${images.length} frames of the same stone.` : "This is a photo of the stone.",
    carat ? `Stated carat weight: ${carat} ct.` : null,
    notes ? `Notes from the person: ${notes}` : null,
  ].filter(Boolean).join("\n");

  try {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: 1200,
      system: STONE_SYSTEM,
      tools: [stoneAnalysisTool],
      tool_choice: { type: "tool", name: stoneAnalysisTool.name },
      messages: [{ role: "user", content: [...images, { type: "text", text }] }],
    });
    const call = msg.content.find((b) => b.type === "tool_use");
    const parsed = Analysis.safeParse(call && "input" in call ? call.input : null);
    if (!parsed.success) return NextResponse.json({ error: "The analysis came back incomplete. Try a clearer photo." }, { status: 502 });
    const a = parsed.data;

    let dims = { lengthMm: a.length_mm ?? 10, widthMm: a.width_mm ?? 8, domeMm: a.dome_mm ?? 3 };
    if (carat && a.size_basis !== "scale reference") dims = estimateDims(a.gem, a.cut, a.shape, carat);

    const stone: Partial<CenterStone> = {
      gem: a.gem,
      cut: a.cut,
      shape: a.shape,
      carat: carat ?? null,
      lengthMm: clamp(dims.lengthMm, 2, 30),
      widthMm: clamp(dims.widthMm, 2, 30),
      domeMm: clamp(dims.domeMm, 0.5, 15),
      color: /^#[0-9a-f]{6}$/i.test(a.color_hex) ? a.color_hex : "#0c2394",
      clarity: clamp(a.clarity, 0, 1),
      label: a.label.slice(0, 120),
      photoPath: paths[0],
    };
    return NextResponse.json({ stone, analysis: { observations: a.observations, cautions: a.cautions, confidence: a.confidence, sizeBasis: carat && a.size_basis !== "scale reference" ? "carat weight" : a.size_basis } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Analysis failed." }, { status: 500 });
  }
}
