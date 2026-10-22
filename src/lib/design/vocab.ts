export const GEMS = [
  "diamond", "sapphire", "yellow-sapphire", "ruby", "emerald", "spinel", "pearl", "coral", "hessonite", "cats-eye",
  "tourmaline", "aquamarine", "tanzanite", "amethyst", "citrine", "garnet", "morganite", "peridot", "opal", "turquoise", "onyx", "jade", "other",
] as const;
export const SHAPES = [
  "round", "oval", "cushion", "pear", "marquise", "heart", "emerald", "asscher", "princess", "radiant", "baguette",
  "octagon", "hexagon", "trillion", "kite", "shield", "half-moon", "old-mine", "old-european",
] as const;
export const STEP_SHAPES = new Set<string>(["emerald", "asscher", "baguette", "octagon", "hexagon", "kite", "shield", "half-moon"]);
export const SHAPE_RATIO: Record<(typeof SHAPES)[number], number> = {
  round: 1, oval: 1.3, cushion: 1.1, pear: 1.5, marquise: 2, heart: 1, emerald: 1.4, asscher: 1, princess: 1, radiant: 1.25,
  baguette: 2.5, octagon: 1, hexagon: 1.15, trillion: 1, kite: 1.5, shield: 1.1, "half-moon": 0.55, "old-mine": 1.05, "old-european": 1,
};
export const SHAPE_FILL: Record<(typeof SHAPES)[number], number> = {
  round: 0.5, oval: 0.52, cushion: 0.58, pear: 0.48, marquise: 0.44, heart: 0.5, emerald: 0.64, asscher: 0.66, princess: 0.7,
  radiant: 0.66, baguette: 0.75, octagon: 0.64, hexagon: 0.62, trillion: 0.38, kite: 0.45, shield: 0.55, "half-moon": 0.5, "old-mine": 0.58, "old-european": 0.5,
};
export const CUTS = ["faceted", "cabochon", "rose-cut", "polki", "briolette", "bead", "carved"] as const;
export const SIDE_KINDS = ["none", "half-moon", "trapezoid", "baguette", "round", "oval", "pear"] as const;
export const SETTINGS = ["double-claw", "six-claw", "four-claw", "bezel"] as const;
export const METALS = ["yellow-gold", "rose-gold", "white-gold", "platinum", "oxidised-silver"] as const;
export const KARATS = [14, 18, 22, 24] as const;
export const BANGLE_SIZES = ["2-2", "2-4", "2-6", "2-8", "2-10", "2-12"] as const;
export const NECKLACE_LENGTHS: { in: number; name: string }[] = [
  { in: 14, name: "Choker / hasli" }, { in: 16, name: "Collar" }, { in: 18, name: "Princess" }, { in: 20, name: "Matinee short" },
  { in: 24, name: "Matinee" }, { in: 28, name: "Rani haar" }, { in: 32, name: "Opera" }, { in: 36, name: "Long opera" },
];
export const BAND_FINISHES = ["polished", "knife-edge", "textured"] as const;
export const CHAIN_STYLES = ["cable", "fine", "box", "rope", "heavy"] as const;

export type Gem = (typeof GEMS)[number];

const BASE_LOOK: Record<Gem, { color: string; clarity: number }> = {
  diamond: { color: "#f4f6fb", clarity: 0.95 }, sapphire: { color: "#0c2394", clarity: 0.4 }, "yellow-sapphire": { color: "#f2c230", clarity: 0.7 },
  ruby: { color: "#b3062a", clarity: 0.45 }, emerald: { color: "#0b7a4b", clarity: 0.45 }, spinel: { color: "#d4245e", clarity: 0.6 },
  pearl: { color: "#f3ede2", clarity: 0 }, coral: { color: "#e2553a", clarity: 0 }, hessonite: { color: "#c8641c", clarity: 0.55 },
  "cats-eye": { color: "#b9a24a", clarity: 0.2 }, tourmaline: { color: "#2f8f6f", clarity: 0.55 }, aquamarine: { color: "#9fd7e8", clarity: 0.85 },
  tanzanite: { color: "#4b3fb0", clarity: 0.6 }, amethyst: { color: "#7a3fa6", clarity: 0.65 }, citrine: { color: "#e9a227", clarity: 0.75 },
  garnet: { color: "#7a0f1c", clarity: 0.5 }, morganite: { color: "#f0b4ae", clarity: 0.75 }, peridot: { color: "#8fbf2a", clarity: 0.7 },
  opal: { color: "#e8eef2", clarity: 0.15 }, turquoise: { color: "#3fb7b0", clarity: 0 }, onyx: { color: "#101012", clarity: 0 }, jade: { color: "#3e8f5a", clarity: 0.25 }, other: { color: "#888888", clarity: 0.5 },
};

export const GEM_LOOK = Object.fromEntries(Object.entries(BASE_LOOK).map(([g, l]) => [g, { ...l, glow: 0 }])) as Record<Gem, { color: string; clarity: number; glow: number }>;

export const BEAD_GEMS = new Set<Gem>(["pearl", "coral", "turquoise", "onyx"]);
