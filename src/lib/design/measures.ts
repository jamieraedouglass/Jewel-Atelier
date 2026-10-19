import { BANGLE_SIZES, type Gem, METALS, SHAPES, SHAPE_FILL, SHAPE_RATIO } from "./vocab";
import { type CenterStone, type Design } from "./schema";

const DENSITY: Record<Gem, number> = {
  diamond: 3.52, sapphire: 4.0, "yellow-sapphire": 4.0, ruby: 4.0, emerald: 2.72, spinel: 3.6, pearl: 2.7, coral: 2.65, hessonite: 3.65,
  "cats-eye": 3.72, tourmaline: 3.06, aquamarine: 2.7, tanzanite: 3.35, amethyst: 2.65, citrine: 2.65, garnet: 3.9, morganite: 2.8,
  peridot: 3.34, opal: 2.1, turquoise: 2.7, onyx: 2.65, jade: 3.3, other: 3.5,
};

const DEPTH: Record<CenterStone["cut"], number> = { faceted: 0.62, "rose-cut": 0.4, polki: 0.22, cabochon: 0.6, briolette: 0.75, bead: 1, carved: 0.6 };

export function estimateDims(gem: Gem, cut: CenterStone["cut"], shape: CenterStone["shape"], carat: number, ratio = SHAPE_RATIO[shape]) {
  const volMm3 = ((carat * 0.2) / DENSITY[gem]) * 1000;
  if (cut === "bead") {
    const w = Math.cbrt((6 * volMm3) / (Math.PI * ratio * (shape === "pear" ? 0.8 : 1)));
    return fitStone(w * ratio, w, w / 2);
  }
  if (cut === "cabochon" || cut === "carved") {
    const k = (2 / 3) * Math.PI * ratio * 1.17;
    const b = Math.cbrt(volMm3 / k);
    return fitStone(2 * b * ratio, 2 * b, 0.9 * b);
  }
  const fill = SHAPE_FILL[shape] * (cut === "faceted" ? FACETED_FILL : 1.35);
  const w = Math.cbrt(volMm3 / (ratio * DEPTH[cut] * fill));
  return fitStone(w * ratio, w, w * (cut === "faceted" ? 0.14 : cut === "rose-cut" ? 0.3 : 0.06));
}

const FACETED_FILL = 0.667;

function fitStone(L: number, W: number, dome: number) {
  const k = Math.min(1, 40 / Math.max(L, W));
  return {
    lengthMm: clamp(round1(L * k), 1, 40),
    widthMm: clamp(round1(W * k), 1, 40),
    domeMm: clamp(round1(dome * k), 0.2, 15),
  };
}

export function sideStoneDims(kind: Design["sides"]["kind"], ct: number) {
  const vol = ((ct * 0.2) / 3.52) * 1000;
  const fill = kind === "round" ? 0.5 : kind === "oval" ? 0.52 : kind === "pear" ? 0.48 : kind === "half-moon" ? 0.55 : 0.62;
  const aspect = kind === "round" ? 1 : kind === "oval" ? 1.35 : kind === "pear" ? 1.5 : kind === "baguette" ? 2.6 : 2.1;
  const W = Math.cbrt(vol / (aspect * 0.6 * fill));
  return { L: W * aspect, W };
}

export const round1 = (n: number) => Math.round(n * 10) / 10;

export const ringInnerDiameter = (usSize: number) => 11.63 + 0.8128 * usSize;
export const indianRingSize = (usSize: number) => Math.round(Math.PI * ringInnerDiameter(usSize) - 40);
export const bangleDiameter = (size: (typeof BANGLE_SIZES)[number]) => (2 + Number(size.split("-")[1]) / 16) * 25.4;
export const isGold = (m: (typeof METALS)[number]) => m === "yellow-gold" || m === "rose-gold" || m === "white-gold";
export const metalName = (d: { metal: (typeof METALS)[number]; purity: { karat: number } }) => (isGold(d.metal) ? `${d.purity.karat}k ${label(d.metal)}` : label(d.metal));

export const roundDiameter = (gem: Gem, ct: number) => 6.5 * Math.cbrt((ct * 3.52) / DENSITY[gem]);

export const label = (s: string) => s.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());

export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export const lengthForShape = (widthMm: number, shape: (typeof SHAPES)[number], min = 1, max = 30) => clamp(round1(widthMm * SHAPE_RATIO[shape]), min, max);

export const stoneRatio = (s: { lengthMm: number; widthMm: number }) => Math.round((s.lengthMm / s.widthMm) * 100) / 100;

export const canReproportion = (shape: (typeof SHAPES)[number]) => shape !== "round" && shape !== "old-mine";

export function reproportion(c: Pick<CenterStone, "gem" | "cut" | "shape" | "carat" | "lengthMm" | "widthMm" | "domeMm">, ratio: number) {
  const r = clamp(ratio, 0.5, 3);
  if (c.carat) return estimateDims(c.gem, c.cut, c.shape, c.carat, r);
  const area = c.lengthMm * c.widthMm;
  const W = Math.sqrt(area / r);
  const k = Math.min(1, 40 / Math.max(W, W * r));
  return { lengthMm: clamp(round1(W * r * k), 1, 40), widthMm: clamp(round1(W * k), 1, 40), domeMm: c.domeMm };
}

export const proportionPresets = (shape: (typeof SHAPES)[number]): [string, number][] => {
  const base = SHAPE_RATIO[shape];
  return [["Short & wide", round2(base * 0.85)], ["Classic", round2(base)], ["Long & slim", round2(base * 1.2)]];
};
const round2 = (n: number) => Math.round(n * 100) / 100;

export function caratFromDims(gem: Gem, cut: CenterStone["cut"], shape: CenterStone["shape"], lengthMm: number, widthMm: number) {
  const L = Math.max(lengthMm, widthMm), W = Math.min(lengthMm, widthMm);
  let volMm3: number;
  if (cut === "bead") volMm3 = (Math.PI / 6) * L * W * W * (shape === "pear" ? 0.8 : 1);
  else if (cut === "cabochon" || cut === "carved") volMm3 = (2 / 3) * Math.PI * (L / 2) * (W / 2) * (W / 2) * 1.17;
  else volMm3 = L * W * W * DEPTH[cut] * SHAPE_FILL[shape] * (cut === "faceted" ? FACETED_FILL : 1.35);
  return Math.round(((volMm3 / 1000) * DENSITY[gem] / 0.2) * 100) / 100;
}
