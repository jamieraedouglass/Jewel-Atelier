import { z } from "zod";

/**
 * A ring design is one plain JSON object. It is what the 3D model renders,
 * what gets saved to the database, what Claude reads, and what Claude proposes
 * changes to. Every field has a sensible default so partial updates are safe.
 */

export const GEMS = ["sapphire", "ruby", "emerald", "diamond", "spinel", "tourmaline", "aquamarine", "other"] as const;
export const SHAPES = ["oval", "round", "cushion", "pear", "emerald", "marquise"] as const;
export const CUTS = ["cabochon", "faceted"] as const;
export const SIDE_KINDS = ["none", "half-moon", "trapezoid", "baguette", "round"] as const;
export const SETTINGS = ["double-claw", "six-claw", "four-claw", "bezel"] as const;
export const METALS = ["white-gold", "yellow-gold", "rose-gold", "platinum"] as const;
export const BAND_FINISHES = ["polished", "knife-edge", "textured"] as const;

export const CenterStoneSchema = z.object({
  gem: z.enum(GEMS).default("sapphire"),
  cut: z.enum(CUTS).default("cabochon"),
  shape: z.enum(SHAPES).default("oval"),
  carat: z.number().min(0.1).max(60).nullable().default(null),
  lengthMm: z.number().min(2).max(30).default(15),
  widthMm: z.number().min(2).max(30).default(12),
  /** height above the girdle: dome height for a cabochon, crown + table for a faceted stone */
  domeMm: z.number().min(0.5).max(15).default(5.4),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0c2394"),
  /** 0 = opaque, 1 = water-clear */
  clarity: z.number().min(0).max(1).default(0.3),
  label: z.string().max(120).default("Royal blue sapphire cabochon"),
  photoPath: z.string().nullable().default(null),
});

export const DesignSchema = z.object({
  name: z.string().max(80).default("Untitled ring"),
  center: CenterStoneSchema.default({}),
  sides: z
    .object({
      kind: z.enum(SIDE_KINDS).default("half-moon"),
      /** approximate carat weight of each side stone */
      sizeCt: z.number().min(0.05).max(3).default(0.5),
    })
    .default({}),
  setting: z
    .object({
      style: z.enum(SETTINGS).default("double-claw"),
      /** 0 = seated down into the shank, 1 = tall cathedral */
      height: z.number().min(0).max(1).default(0.1),
    })
    .default({}),
  gallery: z.object({ roseCut: z.boolean().default(true) }).default({}),
  metal: z.enum(METALS).default("white-gold"),
  band: z
    .object({
      widthMm: z.number().min(1.5).max(6).default(2.3),
      finish: z.enum(BAND_FINISHES).default("polished"),
    })
    .default({}),
  ringSize: z.number().min(3).max(13).default(6.5),
});

export type CenterStone = z.infer<typeof CenterStoneSchema>;
export type Design = z.infer<typeof DesignSchema>;

export const defaultDesign = (): Design => DesignSchema.parse({});

/** Parse anything (DB row, Claude output) into a complete, valid design. */
export function normalizeDesign(input: unknown): Design {
  const r = DesignSchema.safeParse(input ?? {});
  return r.success ? r.data : defaultDesign();
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type DesignPatch = DeepPartial<Design>;

/** Merge a partial change (from a control or from Claude) into a design. */
export function applyPatch(design: Design, patch: DesignPatch): Design {
  const merged: Record<string, unknown> = { ...design };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (design as Record<string, unknown>)[k];
    merged[k] = v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" ? { ...cur, ...v } : v;
  }
  const r = DesignSchema.safeParse(merged);
  return r.success ? r.data : design;
}

/* ---------- gemmology helpers ---------- */

/** specific gravity (g/cm³) */
export const DENSITY: Record<(typeof GEMS)[number], number> = {
  sapphire: 4.0, ruby: 4.0, emerald: 2.72, diamond: 3.52, spinel: 3.6, tourmaline: 3.06, aquamarine: 2.7, other: 3.5,
};

/**
 * Rough dimensions from carat weight. Volume = ct × 0.2 g / SG.
 * Cabochons are modelled as a half-ellipsoid dome plus a shallow belly;
 * faceted stones use a typical depth-to-width ratio and a shape fill factor.
 */
export function estimateDims(gem: CenterStone["gem"], cut: CenterStone["cut"], shape: CenterStone["shape"], carat: number) {
  const volMm3 = ((carat * 0.2) / DENSITY[gem]) * 1000;
  const ratio = { oval: 1.25, round: 1, cushion: 1.1, pear: 1.5, emerald: 1.4, marquise: 2 }[shape];
  if (cut === "cabochon") {
    // V ≈ (2/3)π·a·b·(dome + belly), dome ≈ 0.9·b, belly ≈ 0.27·b
    const k = (2 / 3) * Math.PI * ratio * 1.17;
    const b = Math.cbrt(volMm3 / k);
    return { lengthMm: round1(2 * b * ratio), widthMm: round1(2 * b), domeMm: round1(0.9 * b) };
  }
  const fill = { oval: 0.52, round: 0.5, cushion: 0.58, pear: 0.48, emerald: 0.64, marquise: 0.44 }[shape];
  const depthRatio = 0.62;
  const w = Math.cbrt(volMm3 / (ratio * depthRatio * fill));
  return { lengthMm: round1(w * ratio), widthMm: round1(w), domeMm: round1(w * 0.14) };
}

/** side-stone length/width from carat, for a ~0.6 depth ratio diamond */
export function sideStoneDims(kind: Design["sides"]["kind"], ct: number) {
  const vol = ((ct * 0.2) / 3.52) * 1000;
  const fill = kind === "round" ? 0.5 : kind === "half-moon" ? 0.55 : 0.62;
  const aspect = kind === "round" ? 1 : kind === "baguette" ? 2.6 : 2.1; // L / W
  const W = Math.cbrt(vol / (aspect * 0.6 * fill));
  return { L: W * aspect, W };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** US ring size → inner diameter in mm */
export const ringInnerDiameter = (usSize: number) => 11.63 + 0.8128 * usSize;

export const label = (s: string) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export function describeDesign(d: Design): string {
  const c = d.center;
  return [
    `${c.carat ? `${c.carat} ct ` : ""}${c.gem} ${c.cut === "cabochon" ? "cabochon" : `${c.shape}-cut`} (${c.lengthMm} × ${c.widthMm} mm)`,
    d.sides.kind === "none" ? "solitaire" : `${label(d.sides.kind)} side stones, ~${d.sides.sizeCt} ct each`,
    `${label(d.setting.style)} setting`,
    d.gallery.roseCut ? "rose-cut gallery accents" : null,
    `${label(d.metal)}, ${d.band.finish} band`,
  ]
    .filter(Boolean)
    .join(" · ");
}
