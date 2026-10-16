import { BANGLE_SIZES, type Gem, METALS, SHAPES, SHAPE_FILL, SHAPE_RATIO } from "./vocab";
import { type CenterStone, type Design } from "./schema";

/* ---------------- gemmology helpers ---------------- */

/** specific gravity (g/cm³) */
export const DENSITY: Record<Gem, number> = {
  diamond: 3.52, sapphire: 4.0, "yellow-sapphire": 4.0, ruby: 4.0, emerald: 2.72, spinel: 3.6, pearl: 2.7, coral: 2.65, hessonite: 3.65,
  "cats-eye": 3.72, tourmaline: 3.06, aquamarine: 2.7, tanzanite: 3.35, amethyst: 2.65, citrine: 2.65, garnet: 3.9, morganite: 2.8,
  peridot: 3.34, opal: 2.1, turquoise: 2.7, onyx: 2.65, other: 3.5,
};

const DEPTH: Record<CenterStone["cut"], number> = { faceted: 0.62, "rose-cut": 0.4, polki: 0.22, cabochon: 0.6, briolette: 0.75, bead: 1 };

/**
 * Rough dimensions from carat weight. Volume = ct × 0.2 g / SG.
 * Cabochons: half-ellipsoid dome plus a shallow belly. Faceted, rose-cut and polki: depth ratio × shape fill.
 */
export function estimateDims(gem: Gem, cut: CenterStone["cut"], shape: CenterStone["shape"], carat: number, ratio = SHAPE_RATIO[shape]) {
  const volMm3 = ((carat * 0.2) / DENSITY[gem]) * 1000;
  if (cut === "bead") {
    // a polished bead is an ellipsoid (a pear drop holds a little less): volume = π/6 × length × width²
    const w = Math.cbrt((6 * volMm3) / (Math.PI * ratio * (shape === "pear" ? 0.8 : 1)));
    return fitStone(w * ratio, w, w / 2);
  }
  if (cut === "cabochon") {
    const k = (2 / 3) * Math.PI * ratio * 1.17;
    const b = Math.cbrt(volMm3 / k);
    return fitStone(2 * b * ratio, 2 * b, 0.9 * b);
  }
  const fill = SHAPE_FILL[shape] * (cut === "faceted" ? FACETED_FILL : 1.35);
  const w = Math.cbrt(volMm3 / (ratio * DEPTH[cut] * fill));
  return fitStone(w * ratio, w, w * (cut === "faceted" ? 0.14 : cut === "rose-cut" ? 0.3 : 0.06));
}

/**
 * A faceted stone tapers to a point below the girdle, so it holds less than its depth × outline: a round brilliant is
 * about 0.215 × width³. This scales SHAPE_FILL to match, so 1 ct of round diamond comes out at 6.5 mm (as roundDiameter).
 */
const FACETED_FILL = 0.667;

/** keep estimated sizes within what a main stone can be (1–40 mm, dome 0.2–15 mm), scaling both sides together */
function fitStone(L: number, W: number, dome: number) {
  const k = Math.min(1, 40 / Math.max(L, W));
  return {
    lengthMm: clamp(round1(L * k), 1, 40),
    widthMm: clamp(round1(W * k), 1, 40),
    domeMm: clamp(round1(dome * k), 0.2, 15),
  };
}

/** side-stone length/width from carat, for a ~0.6 depth ratio diamond */
export function sideStoneDims(kind: Design["sides"]["kind"], ct: number) {
  const vol = ((ct * 0.2) / 3.52) * 1000;
  const fill = kind === "round" ? 0.5 : kind === "oval" ? 0.52 : kind === "pear" ? 0.48 : kind === "half-moon" ? 0.55 : 0.62;
  const aspect = kind === "round" ? 1 : kind === "oval" ? 1.35 : kind === "pear" ? 1.5 : kind === "baguette" ? 2.6 : 2.1;
  const W = Math.cbrt(vol / (aspect * 0.6 * fill));
  return { L: W * aspect, W };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** US ring size → inner diameter in mm */
export const ringInnerDiameter = (usSize: number) => 11.63 + 0.8128 * usSize;
/** Indian ring size ≈ inner circumference in mm − 40 */
export const indianRingSize = (usSize: number) => Math.round(Math.PI * ringInnerDiameter(usSize) - 40);
/** bangle inner diameter in mm from an Indian size like "2-6" */
export const bangleDiameter = (size: (typeof BANGLE_SIZES)[number]) => (2 + Number(size.split("-")[1]) / 16) * 25.4;
export const isGold = (m: (typeof METALS)[number]) => m === "yellow-gold" || m === "rose-gold" || m === "white-gold";
export const metalName = (d: { metal: (typeof METALS)[number]; purity: { karat: number } }) => (isGold(d.metal) ? `${d.purity.karat}k ${label(d.metal)}` : label(d.metal));

/** round-brilliant diameter (mm) for a carat weight; 1 ct diamond ≈ 6.5 mm */
export const roundDiameter = (gem: Gem, ct: number) => 6.5 * Math.cbrt((ct * 3.52) / DENSITY[gem]);

export const label = (s: string) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** a stone's length for a new shape at the same width, kept within the stone's allowed range */
export const lengthForShape = (widthMm: number, shape: (typeof SHAPES)[number], min = 1, max = 30) => clamp(round1(widthMm * SHAPE_RATIO[shape]), min, max);

/** a stone's length ÷ width, e.g. 1.4 for a classic oval */
export const stoneRatio = (s: { lengthMm: number; widthMm: number }) => Math.round((s.lengthMm / s.widthMm) * 100) / 100;

/** whether a shape can be cut longer or shorter (a round is always round) */
export const canReproportion = (shape: (typeof SHAPES)[number]) => shape !== "round" && shape !== "old-mine";

/**
 * The same stone cut to different proportions: an oval fat and short or long and slim. With a carat weight the
 * weight stays and the size follows it; without one the stone keeps its face area, so it looks about as big.
 */
export function reproportion(c: Pick<CenterStone, "gem" | "cut" | "shape" | "carat" | "lengthMm" | "widthMm" | "domeMm">, ratio: number) {
  const r = clamp(ratio, 0.5, 3);
  if (c.carat) return estimateDims(c.gem, c.cut, c.shape, c.carat, r);
  const area = c.lengthMm * c.widthMm;
  const W = Math.sqrt(area / r);
  const k = Math.min(1, 40 / Math.max(W, W * r));
  return { lengthMm: clamp(round1(W * r * k), 1, 40), widthMm: clamp(round1(W * k), 1, 40), domeMm: c.domeMm };
}

/** quick proportions for a shape: short and wide, its classic cut, long and slim */
export const proportionPresets = (shape: (typeof SHAPES)[number]): [string, number][] => {
  const base = SHAPE_RATIO[shape];
  return [["Short & wide", round2(base * 0.85)], ["Classic", round2(base)], ["Long & slim", round2(base * 1.2)]];
};
const round2 = (n: number) => Math.round(n * 100) / 100;
