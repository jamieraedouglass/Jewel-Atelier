import { z } from "zod";

/**
 * A design (any piece of jewellery) is one plain JSON object. It is what the 3D model renders,
 * what gets saved to the database, what Claude reads, and what Claude proposes changes to.
 * Every field has a default, so partial updates are always safe.
 */

/* ---------------- vocabularies ---------------- */

export const GEMS = [
  "diamond", "sapphire", "yellow-sapphire", "ruby", "emerald", "spinel", "pearl", "coral", "hessonite", "cats-eye",
  "tourmaline", "aquamarine", "tanzanite", "amethyst", "citrine", "garnet", "morganite", "peridot", "opal", "turquoise", "onyx", "other",
] as const;
export const SHAPES = [
  "round", "oval", "cushion", "pear", "marquise", "heart", "emerald", "asscher", "princess", "radiant", "baguette",
  "octagon", "hexagon", "trillion", "kite", "shield", "half-moon", "old-mine",
] as const;
/** step-cut shapes get parallel step facets; the rest get brilliant facets */
export const STEP_SHAPES = new Set<string>(["emerald", "asscher", "baguette", "octagon", "hexagon", "kite", "shield", "half-moon"]);
/** typical length ÷ width per shape */
export const SHAPE_RATIO: Record<(typeof SHAPES)[number], number> = {
  round: 1, oval: 1.3, cushion: 1.1, pear: 1.5, marquise: 2, heart: 1, emerald: 1.4, asscher: 1, princess: 1, radiant: 1.25,
  baguette: 2.5, octagon: 1, hexagon: 1.15, trillion: 1, kite: 1.5, shield: 1.1, "half-moon": 0.55, "old-mine": 1.05,
};
/** how much of the bounding box the outline fills, for carat ↔ mm estimates */
const SHAPE_FILL: Record<(typeof SHAPES)[number], number> = {
  round: 0.5, oval: 0.52, cushion: 0.58, pear: 0.48, marquise: 0.44, heart: 0.5, emerald: 0.64, asscher: 0.66, princess: 0.7,
  radiant: 0.66, baguette: 0.75, octagon: 0.64, hexagon: 0.62, trillion: 0.38, kite: 0.45, shield: 0.55, "half-moon": 0.5, "old-mine": 0.58,
};
/** polki = flat uncut diamond with a foil back; rose-cut = faceted dome with a flat base */
export const CUTS = ["faceted", "cabochon", "rose-cut", "polki"] as const;
export const SIDE_KINDS = ["none", "half-moon", "trapezoid", "baguette", "round"] as const;
export const SETTINGS = ["double-claw", "six-claw", "four-claw", "bezel"] as const;
export const METALS = ["yellow-gold", "rose-gold", "white-gold", "platinum", "oxidised-silver"] as const;
export const KARATS = [14, 18, 22, 24] as const;
/** Indian bangle sizes: "2-6" means 2 6/16 inch inner diameter */
export const BANGLE_SIZES = ["2-2", "2-4", "2-6", "2-8", "2-10", "2-12"] as const;
export const NECKLACE_LENGTHS: { in: number; name: string }[] = [
  { in: 14, name: "Choker / hasli" }, { in: 16, name: "Collar" }, { in: 18, name: "Princess" }, { in: 20, name: "Matinee short" },
  { in: 24, name: "Matinee" }, { in: 28, name: "Rani haar" }, { in: 32, name: "Opera" }, { in: 36, name: "Long opera" },
];
export const BAND_FINISHES = ["polished", "knife-edge", "textured"] as const;
export const CHAIN_STYLES = ["cable", "fine", "box", "rope"] as const;

export type Gem = (typeof GEMS)[number];

/** body colour + default transparency per gem, used when a gem is picked */
export const GEM_LOOK: Record<Gem, { color: string; clarity: number }> = {
  diamond: { color: "#f4f6fb", clarity: 0.95 }, sapphire: { color: "#0c2394", clarity: 0.4 }, "yellow-sapphire": { color: "#f2c230", clarity: 0.7 },
  ruby: { color: "#b3062a", clarity: 0.45 }, emerald: { color: "#0b7a4b", clarity: 0.45 }, spinel: { color: "#d4245e", clarity: 0.6 },
  pearl: { color: "#f3ede2", clarity: 0 }, coral: { color: "#e2553a", clarity: 0 }, hessonite: { color: "#c8641c", clarity: 0.55 },
  "cats-eye": { color: "#b9a24a", clarity: 0.2 }, tourmaline: { color: "#2f8f6f", clarity: 0.55 }, aquamarine: { color: "#9fd7e8", clarity: 0.85 },
  tanzanite: { color: "#4b3fb0", clarity: 0.6 }, amethyst: { color: "#7a3fa6", clarity: 0.65 }, citrine: { color: "#e9a227", clarity: 0.75 },
  garnet: { color: "#7a0f1c", clarity: 0.5 }, morganite: { color: "#f0b4ae", clarity: 0.75 }, peridot: { color: "#8fbf2a", clarity: 0.7 },
  opal: { color: "#e8eef2", clarity: 0.15 }, turquoise: { color: "#3fb7b0", clarity: 0 }, onyx: { color: "#101012", clarity: 0 }, other: { color: "#888888", clarity: 0.5 },
};

/** gems that are drilled beads or have no facets */
export const BEAD_GEMS = new Set<Gem>(["pearl", "coral", "turquoise", "onyx"]);

/* ---------------- piece types and styles ---------------- */

export const TYPES = ["ring", "earrings", "necklace", "bracelet", "anklet", "headpiece", "nose", "armlet", "hand"] as const;
export type PieceType = (typeof TYPES)[number];

export const TYPE_LABEL: Record<PieceType, string> = {
  ring: "Ring", earrings: "Earrings", necklace: "Necklace", bracelet: "Bracelet & bangle", anklet: "Anklet (payal)",
  headpiece: "Maang tikka & matha patti", nose: "Nath & nose stud", armlet: "Bajuband", hand: "Haathphool",
};

/** which controls a style uses */
export type Use =
  | "center" | "accents" | "fringe" | "enamel" | "setting" | "sides" | "band" | "ringSize" | "halo" | "accentTop" | "pave"
  | "hoop" | "length" | "wrist" | "chain" | "count" | "layers" | "motif" | "accentShapes" | "extraStones";

type StyleMeta = { label: string; blurb: string; uses: Use[]; defaults?: DesignPatch };

const CORE: Use[] = ["center", "setting"];

export const STYLES: Record<PieceType, Record<string, StyleMeta>> = {
  ring: {
    "three-stone": { label: "Three-stone", blurb: "Centre stone with a matched pair of side stones.", uses: [...CORE, "sides", "band", "ringSize"] },
    solitaire: { label: "Solitaire", blurb: "One stone, nothing competing.", uses: [...CORE, "band", "ringSize"] },
    halo: { label: "Halo", blurb: "A ring of small stones framing the centre.", uses: [...CORE, "accents", "sides", "band", "ringSize"], defaults: { sides: { kind: "none" }, accents: { sizeCt: 0.04 } } },
    cluster: { label: "Cluster", blurb: "Petal stones around the centre, like a flower.", uses: [...CORE, "accents", "band", "ringSize"], defaults: { sides: { kind: "none" }, accents: { sizeCt: 0.4 } } },
    navratna: { label: "Navratna", blurb: "Ruby centre ringed by the eight other planetary gems.", uses: [...CORE, "band", "ringSize"], defaults: { sides: { kind: "none" }, center: { gem: "ruby", cut: "faceted", shape: "round", lengthMm: 7, widthMm: 7, domeMm: 1.2, color: "#b3062a", clarity: 0.45, label: "Ruby" } } },
    "polki-cocktail": { label: "Polki cocktail", blurb: "Big polki centre, double halo with a pearl fringe.", uses: [...CORE, "accents", "fringe", "band", "ringSize"], defaults: { sides: { kind: "none" }, center: { gem: "diamond", cut: "polki", shape: "cushion", lengthMm: 14, widthMm: 12, domeMm: 0.8, color: "#f4f6fb", clarity: 0.9, label: "Polki diamond" }, fringe: { enabled: true } } },
    eternity: { label: "Eternity band", blurb: "Stones all the way round.", uses: ["accents", "band", "ringSize"], defaults: { accents: { sizeCt: 0.1 } } },
    "motif-ring": { label: "Custom motif", blurb: "Your own shape — described, sketched or from an SVG — as the ring top.", uses: ["motif", "center", "accents", "enamel", "band", "ringSize"] },
  },
  earrings: {
    stud: { label: "Stud", blurb: "One stone, or several in a row (toi-et-moi, clusters), each in its own shape, gem and angle.", uses: [...CORE, "halo", "accents", "extraStones"] },
    drop: { label: "Drop", blurb: "The stone hangs below a small top stone.", uses: [...CORE, "accentTop", "accents"] },
    hoop: { label: "Hoop", blurb: "Hoop, plain or pavé, with an optional charm.", uses: [...CORE, "hoop", "pave", "accents"] },
    huggie: { label: "Huggie", blurb: "Small, thick hoop that hugs the lobe.", uses: ["accents", "pave"], defaults: { options: { hoopDiameterMm: 12, pave: true } } },
    chandelier: { label: "Chandelier", blurb: "Tiers of stones fanning out, finished with drops.", uses: [...CORE, "accents", "fringe", "count"], defaults: { options: { count: 3 } } },
    jhumka: { label: "Jhumka", blurb: "Kundan top with a bell below and a pearl fringe.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
    chandbali: { label: "Chandbali", blurb: "Crescent moon set with stones, fringed with pearls.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
    climber: { label: "Ear climber", blurb: "Graduated line of stones climbing the ear.", uses: ["accents", "count"], defaults: { options: { count: 7 } } },
    tassel: { label: "Tassel", blurb: "Stud top with strands of beads swinging below.", uses: [...CORE, "fringe", "count"], defaults: { fringe: { enabled: true }, options: { count: 5 } } },
    motif: { label: "Custom motif", blurb: "Your own shape hanging from a small stud.", uses: ["motif", "center", "accents", "enamel", "fringe"] },
  },
  necklace: {
    pendant: { label: "Pendant", blurb: "One stone on a chain.", uses: [...CORE, "halo", "accents", "length", "chain"] },
    riviera: { label: "Riviera", blurb: "A continuous line of graduated stones.", uses: [...CORE, "length", "count"], defaults: { options: { count: 33, lengthIn: 16 } } },
    station: { label: "Station / by the yard", blurb: "Stones spaced along a fine chain.", uses: [...CORE, "length", "chain", "count"], defaults: { options: { count: 7, chain: "fine" } } },
    lariat: { label: "Lariat / Y", blurb: "A loop with a long drop ending in the stone.", uses: [...CORE, "length", "chain", "accents"] },
    choker: { label: "Choker", blurb: "Several rows of stones, close to the neck.", uses: ["accents", "fringe", "layers"], defaults: { options: { lengthIn: 14, layers: 3 } } },
    collar: { label: "Collar / bib", blurb: "Graduated drops hanging from the front.", uses: [...CORE, "accents", "length", "count"], defaults: { options: { lengthIn: 16, count: 15 } } },
    "kundan-choker": { label: "Kundan choker", blurb: "Polki plates with enamel backs and a pearl fringe.", uses: [...CORE, "fringe", "enamel", "count"], defaults: { options: { lengthIn: 14, count: 9 }, fringe: { enabled: true }, enamel: { enabled: true } } },
    "rani-haar": { label: "Rani haar", blurb: "Long multi-strand necklace with a grand pendant.", uses: [...CORE, "accents", "fringe", "enamel", "layers", "length"], defaults: { options: { lengthIn: 28, layers: 4 }, fringe: { enabled: true } } },
    temple: { label: "Temple", blurb: "Gold coin motifs with a ruby-set centre coin.", uses: [...CORE, "count", "length", "fringe"], defaults: { options: { count: 17, lengthIn: 20 } } },
    mangalsutra: { label: "Mangalsutra", blurb: "Black bead strands with gold beads and a pendant.", uses: [...CORE, "length", "layers"], defaults: { options: { lengthIn: 20, layers: 2 } } },
    "pearl-strand": { label: "Pearl strand", blurb: "Layered strands of pearls or beads.", uses: ["fringe", "layers", "length"], defaults: { options: { layers: 1, lengthIn: 18 }, fringe: { enabled: true, sizeMm: 7 } } },
    "motif-pendant": { label: "Custom motif pendant", blurb: "Your own shape as the pendant.", uses: ["motif", "center", "accents", "enamel", "fringe", "length", "chain"] },
    "motif-station": { label: "Custom motif stations", blurb: "Your shape repeated along a chain.", uses: ["motif", "center", "accents", "enamel", "length", "chain", "count"], defaults: { options: { count: 7 } } },
  },
  bracelet: {
    tennis: { label: "Tennis", blurb: "A full line of stones: one shape, or a repeating mix like oval–round.", uses: ["accents", "accentShapes", "wrist"] },
    bangle: { label: "Bangle", blurb: "Solid bangle with a centre stone.", uses: [...CORE, "wrist"] },
    kada: { label: "Kada", blurb: "Heavy bangle with stones all round the front.", uses: ["accents", "enamel", "wrist", "center", "setting"] },
    cuff: { label: "Cuff", blurb: "Open cuff with a centre stone and rows of accents.", uses: [...CORE, "accents", "wrist", "layers"], defaults: { options: { layers: 2 } } },
    station: { label: "Station", blurb: "Stones spaced along a chain.", uses: [...CORE, "chain", "count", "wrist"], defaults: { options: { count: 5, chain: "fine" } } },
    charm: { label: "Charm", blurb: "Chain with dangling set-stone charms.", uses: [...CORE, "chain", "count", "wrist"], defaults: { options: { count: 7 } } },
    beaded: { label: "Beaded", blurb: "Strand of beads around a centre stone.", uses: [...CORE, "fringe", "wrist", "layers"], defaults: { fringe: { enabled: true, sizeMm: 6 }, options: { layers: 1 } } },
    "motif-station": { label: "Custom motif", blurb: "Your shape repeated along a chain.", uses: ["motif", "center", "accents", "enamel", "chain", "count", "wrist"], defaults: { options: { count: 5 } } },
  },
  anklet: {
    payal: { label: "Payal", blurb: "Chain with ghungroo bells all round.", uses: ["chain", "count", "accents", "enamel"], defaults: { options: { count: 24, chain: "box" } } },
    "station-anklet": { label: "Station anklet", blurb: "Fine chain with a few set stones.", uses: [...CORE, "chain", "count"], defaults: { options: { count: 5, chain: "fine" } } },
  },
  headpiece: {
    "maang-tikka": { label: "Maang tikka", blurb: "A pendant on the forehead, hung from a chain in the parting.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
    "matha-patti": { label: "Matha patti", blurb: "Tikka plus chains sweeping along the hairline.", uses: [...CORE, "accents", "fringe", "count", "enamel"], defaults: { fringe: { enabled: true }, options: { count: 5 } } },
  },
  nose: {
    nath: { label: "Nath", blurb: "Large hoop with pearls and beads, chained to the ear.", uses: ["fringe", "accents", "hoop"], defaults: { options: { hoopDiameterMm: 34 }, fringe: { enabled: true, sizeMm: 3.5 } } },
    "nose-stud": { label: "Nose stud", blurb: "A single small stone.", uses: [...CORE, "halo", "accents"], defaults: { center: { gem: "diamond", cut: "faceted", shape: "round", lengthMm: 2.5, widthMm: 2.5, domeMm: 0.4, color: "#f4f6fb", clarity: 0.95, label: "Diamond" } } },
  },
  armlet: {
    bajuband: { label: "Bajuband", blurb: "Armband with a centre motif and stone-set wings.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
  },
  hand: {
    haathphool: { label: "Haathphool", blurb: "Bracelet and ring joined by chains over the hand.", uses: [...CORE, "accents", "chain", "enamel"] },
  },
};

/** the motif style to switch to when a motif is created for a piece type that has one */
export const MOTIF_STYLE: Partial<Record<PieceType, string>> = { ring: "motif-ring", earrings: "motif", necklace: "motif-pendant", bracelet: "motif-station" };

export const ALL_STYLES = Array.from(new Set(Object.values(STYLES).flatMap((s) => Object.keys(s))));
export const firstStyle = (t: PieceType) => Object.keys(STYLES[t])[0];
export const styleMeta = (t: PieceType, s: string): StyleMeta => STYLES[t][s] ?? STYLES[t][firstStyle(t)];
export const uses = (d: Design, u: Use) => styleMeta(d.type, d.style).uses.includes(u);

/* ---------------- schema ---------------- */

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/* ---------------- custom motifs ---------------- */

/** a paisley (kairi), so motif styles have something to show before you make your own */
export const SAMPLE_MOTIF_PATH =
  "M45 95 C18 92 8 65 18 45 C28 25 50 22 60 12 C66 6 70 2 76 4 C83 7 83 15 77 19 C72 22 67 18 70 14 C65 27 81 41 83 59 C86 81 68 97 45 95 Z";

/** SVG path characters only: no scripts, no markup */
const svgPath = z.string().max(60000).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/, "Only SVG path commands are allowed");

export const MotifStoneSchema = z.object({
  x: z.number(), y: z.number(), r: z.number().positive(),
  /** "center" uses the main stone (gem, cut, colour); "accent" uses the accent stones */
  kind: z.enum(["center", "accent"]).default("accent"),
});

export const MotifSchema = z.object({
  name: z.string().max(80).default("Paisley (kairi)"),
  /** SVG path data; may contain several sub-paths, and inner sub-paths become cut-outs */
  path: svgPath.default(SAMPLE_MOTIF_PATH),
  /** the drawing's coordinate box [minX, minY, width, height]; stones use the same coordinates */
  viewBox: z.tuple([z.number(), z.number(), z.number().positive(), z.number().positive()]).default([0, 0, 100, 100]),
  widthMm: z.number().min(4).max(120).default(24),
  thicknessMm: z.number().min(0.4).max(6).default(1.4),
  edge: z.enum(["smooth", "millegrain", "rope"]).default("millegrain"),
  stones: z.array(MotifStoneSchema).max(300).default([
    { x: 50, y: 66, r: 11, kind: "center" },
    ...[[30, 50], [36, 36], [48, 28], [62, 22], [70, 34], [74, 50], [74, 68], [66, 82], [52, 88], [36, 84], [26, 70]].map(([x, y]) => ({ x, y, r: 3.4, kind: "accent" as const })),
  ]),
});
export type Motif = z.infer<typeof MotifSchema>;

export const CenterStoneSchema = z.object({
  gem: z.enum(GEMS).default("sapphire"),
  cut: z.enum(CUTS).default("cabochon"),
  shape: z.enum(SHAPES).default("oval"),
  carat: z.number().min(0.01).max(200).nullable().default(null),
  lengthMm: z.number().min(1).max(40).default(15),
  widthMm: z.number().min(1).max(40).default(12),
  /** height above the girdle: dome height for a cabochon, crown height for a faceted stone */
  domeMm: z.number().min(0.2).max(15).default(5.4),
  color: hex.default("#0c2394"),
  /** 0 = opaque, 1 = water-clear */
  clarity: z.number().min(0).max(1).default(0.3),
  label: z.string().max(120).default("Royal blue sapphire cabochon"),
  photoPath: z.string().nullable().default(null),
  /** turn the stone in its setting, degrees (e.g. 90 sets an oval east–west) */
  rotation: z.number().min(-180).max(180).default(0),
});

/** an extra stone in a multi-stone stud: its own gem, cut, shape and size, placed below the previous stone */
export const ExtraStoneSchema = z.object({
  gem: z.enum(GEMS).default("diamond"),
  cut: z.enum(CUTS).default("faceted"),
  shape: z.enum(SHAPES).default("pear"),
  lengthMm: z.number().min(1).max(30).default(7),
  widthMm: z.number().min(1).max(30).default(5),
  domeMm: z.number().min(0.2).max(12).default(0.8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f4f6fb"),
  clarity: z.number().min(0).max(1).default(0.95),
  rotation: z.number().min(-180).max(180).default(0),
  /** nudge from its automatic spot, mm */
  dx: z.number().min(-30).max(30).default(0),
  dz: z.number().min(-30).max(30).default(0),
});
export type ExtraStone = z.infer<typeof ExtraStoneSchema>;

export const DesignSchema = z
  .object({
    type: z.enum(TYPES).default("ring"),
    style: z.string().default("three-stone"),
    name: z.string().max(80).default("Untitled piece"),
    /** the main stone: a ring's centre, each earring's stone, a pendant, tikka or bangle centre */
    center: CenterStoneSchema.default({}),
    /** small repeated stones: halos, pavé, riviera and tennis lines, chandelier tiers */
    accents: z.object({
      gem: z.enum(GEMS).default("diamond"), color: hex.default("#f4f6fb"), cut: z.enum(["faceted", "polki", "rose-cut"]).default("faceted"),
      sizeCt: z.number().min(0.005).max(6).default(0.1),
      /** stone shapes in repeating order, e.g. ["round", "round", "round", "marquise"] (tennis styles) */
      shapes: z.array(z.enum(SHAPES)).min(1).max(12).default(["round"]),
      /** which way elongated stones point: along the line, across it, or alternating */
      orientation: z.enum(["along", "across", "alternate"]).default("along"),
    }).default({}),
    /** hanging beads: pearl fringes, tassels, bead strands */
    fringe: z.object({ enabled: z.boolean().default(false), gem: z.enum(GEMS).default("pearl"), color: hex.default("#f3ede2"), sizeMm: z.number().min(1.5).max(14).default(4) }).default({}),
    /** meenakari enamel on plates and backs */
    enamel: z.object({ enabled: z.boolean().default(false), color: hex.default("#16704c") }).default({}),
    metal: z.enum(METALS).default("white-gold"),
    /** gold purity */
    purity: z.object({ karat: z.union([z.literal(14), z.literal(18), z.literal(22), z.literal(24)]).default(18) }).default({}),
    setting: z.object({ style: z.enum(SETTINGS).default("double-claw"), height: z.number().min(0).max(1).default(0.1) }).default({}),
    /* ring */
    sides: z.object({ kind: z.enum(SIDE_KINDS).default("half-moon"), sizeCt: z.number().min(0.05).max(3).default(0.5) }).default({}),
    gallery: z.object({ roseCut: z.boolean().default(true) }).default({}),
    band: z.object({ widthMm: z.number().min(1.5).max(8).default(2.3), finish: z.enum(BAND_FINISHES).default("polished") }).default({}),
    ringSize: z.number().min(3).max(13).default(6.5),
    /** more stones in each stud (toi-et-moi, clusters), stacked below the main stone */
    extraStones: z.array(ExtraStoneSchema).max(6).default([]),
    /** mirror the second earring of a pair */
    mirrorPair: z.boolean().default(true),
    /** a custom shape, used by the motif styles */
    motif: MotifSchema.default({}),
    /* everything else */
    options: z
      .object({
        halo: z.boolean().default(false),
        accentTop: z.boolean().default(true),
        pave: z.boolean().default(true),
        hoopDiameterMm: z.number().min(8).max(70).default(22),
        lengthIn: z.number().min(12).max(40).default(18),
        wristCm: z.number().min(13).max(24).default(16.5),
        bangleSize: z.enum(BANGLE_SIZES).default("2-6"),
        chain: z.enum(CHAIN_STYLES).default("cable"),
        count: z.number().int().min(1).max(80).default(7),
        layers: z.number().int().min(1).max(7).default(3),
      })
      .default({}),
  })
  .transform((d) => (STYLES[d.type][d.style] ? d : { ...d, style: firstStyle(d.type) }));

export type CenterStone = z.infer<typeof CenterStoneSchema>;
export type Design = z.output<typeof DesignSchema>;

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

/** largest sensible main stone (mm, longest side) for each type; specific styles override */
const STONE_MAX: Record<PieceType, number> = { ring: 40, earrings: 11, necklace: 22, bracelet: 14, anklet: 6, headpiece: 16, nose: 5, armlet: 16, hand: 12 };
const STYLE_STONE_MAX: Record<string, number> = { riviera: 6.5, station: 6, "kundan-choker": 9, collar: 9, charm: 6, "station-anklet": 5, chandelier: 7, tassel: 7, jhumka: 8, chandbali: 9, temple: 9, mangalsutra: 10 };

/** Switch type and/or style, applying that style's defaults and scaling an oversized main stone to suit. */
export function chooseStyle(design: Design, type: PieceType, style?: string): Design {
  const s = style && STYLES[type][style] ? style : firstStyle(type);
  let next = applyPatch(applyPatch(design, { type, style: s }), STYLES[type][s].defaults ?? {});
  const max = STYLE_STONE_MAX[s] ?? STONE_MAX[type];
  const c = next.center, longest = Math.max(c.lengthMm, c.widthMm);
  if (longest > max) {
    const k = max / longest;
    next = applyPatch(next, { center: { lengthMm: round1(c.lengthMm * k), widthMm: round1(c.widthMm * k), domeMm: Math.max(0.2, round1(c.domeMm * k)), carat: null } });
  }
  return next;
}

/* ---------------- gemmology helpers ---------------- */

/** specific gravity (g/cm³) */
export const DENSITY: Record<Gem, number> = {
  diamond: 3.52, sapphire: 4.0, "yellow-sapphire": 4.0, ruby: 4.0, emerald: 2.72, spinel: 3.6, pearl: 2.7, coral: 2.65, hessonite: 3.65,
  "cats-eye": 3.72, tourmaline: 3.06, aquamarine: 2.7, tanzanite: 3.35, amethyst: 2.65, citrine: 2.65, garnet: 3.9, morganite: 2.8,
  peridot: 3.34, opal: 2.1, turquoise: 2.7, onyx: 2.65, other: 3.5,
};

const DEPTH: Record<CenterStone["cut"], number> = { faceted: 0.62, "rose-cut": 0.4, polki: 0.22, cabochon: 0.6 };

/**
 * Rough dimensions from carat weight. Volume = ct × 0.2 g / SG.
 * Cabochons: half-ellipsoid dome plus a shallow belly. Faceted, rose-cut and polki: depth ratio × shape fill.
 */
export function estimateDims(gem: Gem, cut: CenterStone["cut"], shape: CenterStone["shape"], carat: number) {
  const volMm3 = ((carat * 0.2) / DENSITY[gem]) * 1000;
  const ratio = SHAPE_RATIO[shape];
  if (cut === "cabochon") {
    const k = (2 / 3) * Math.PI * ratio * 1.17;
    const b = Math.cbrt(volMm3 / k);
    return { lengthMm: round1(2 * b * ratio), widthMm: round1(2 * b), domeMm: round1(0.9 * b) };
  }
  const fill = SHAPE_FILL[shape] * (cut === "faceted" ? 1 : 1.35);
  const w = Math.cbrt(volMm3 / (ratio * DEPTH[cut] * fill));
  return { lengthMm: round1(w * ratio), widthMm: round1(w), domeMm: round1(w * (cut === "faceted" ? 0.14 : cut === "rose-cut" ? 0.3 : 0.06)) };
}

/** side-stone length/width from carat, for a ~0.6 depth ratio diamond */
export function sideStoneDims(kind: Design["sides"]["kind"], ct: number) {
  const vol = ((ct * 0.2) / 3.52) * 1000;
  const fill = kind === "round" ? 0.5 : kind === "half-moon" ? 0.55 : 0.62;
  const aspect = kind === "round" ? 1 : kind === "baguette" ? 2.6 : 2.1;
  const W = Math.cbrt(vol / (aspect * 0.6 * fill));
  return { L: W * aspect, W };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

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

const gemName = (g: Gem) => (g === "cats-eye" ? "cat's eye" : label(g).toLowerCase());

export function stoneText(c: CenterStone) {
  const cut = c.cut === "cabochon" ? "cabochon" : c.cut === "polki" ? "polki" : c.cut === "rose-cut" ? "rose-cut" : `${c.shape}-cut`;
  return `${c.carat ? `${c.carat} ct ` : ""}${gemName(c.gem)} ${cut} (${c.lengthMm} × ${c.widthMm} mm)`;
}

export function describeDesign(d: Design): string {
  const m = styleMeta(d.type, d.style);
  const o = d.options;
  const parts: (string | null)[] = [`${m.label}${d.type === "ring" || d.type === "earrings" || d.type === "necklace" ? ` ${TYPE_LABEL[d.type].toLowerCase()}` : ""}`];
  if (m.uses.includes("center")) parts.push(stoneText(d.center));
  if (m.uses.includes("sides") && d.sides.kind !== "none") parts.push(`${label(d.sides.kind)} sides ~${d.sides.sizeCt} ct`);
  if (m.uses.includes("accents") || (m.uses.includes("halo") && o.halo)) parts.push(`${gemName(d.accents.gem)} accents ~${d.accents.sizeCt} ct`);
  if (m.uses.includes("fringe") && d.fringe.enabled) parts.push(`${gemName(d.fringe.gem)} ${d.fringe.sizeMm} mm fringe`);
  if (m.uses.includes("enamel") && d.enamel.enabled) parts.push("meenakari enamel");
  if (m.uses.includes("length")) parts.push(`${o.lengthIn}"`);
  if (m.uses.includes("layers") && o.layers > 1) parts.push(`${o.layers} rows`);
  if (d.type === "ring") parts.push(`US ${d.ringSize} / Indian ${indianRingSize(d.ringSize)}`);
  if (m.uses.includes("wrist") && ["bangle", "kada", "cuff"].includes(d.style)) parts.push(`size ${o.bangleSize}`);
  parts.push(metalName(d));
  return parts.filter(Boolean).join(" · ");
}

/* ---------------- showcase starting points ---------------- */

const diamond = (shape: CenterStone["shape"], ct: number, name: string, cut: CenterStone["cut"] = "faceted"): Partial<CenterStone> => ({
  gem: "diamond", cut, shape, carat: ct, ...estimateDims("diamond", cut, shape, ct), color: "#f4f6fb", clarity: 0.95, label: name, photoPath: null,
});
const gem = (g: Gem, cut: CenterStone["cut"], shape: CenterStone["shape"], ct: number, name: string): Partial<CenterStone> => ({
  gem: g, cut, shape, carat: ct, ...estimateDims(g, cut, shape, ct), ...GEM_LOOK[g], label: name, photoPath: null,
});

export const SHOWCASE: { name: string; type: PieceType; style: string; patch: DesignPatch }[] = [
  { name: "Burmese sapphire, half-moons", type: "ring", style: "three-stone", patch: { metal: "white-gold" } },
  { name: "Polki bridal jhumkas", type: "earrings", style: "jhumka", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: diamond("round", 1, "Polki diamond", "polki"), accents: { gem: "ruby", color: GEM_LOOK.ruby.color, sizeCt: 0.08 }, enamel: { enabled: true, color: "#16704c" } } },
  { name: "Emerald chandbalis", type: "earrings", style: "chandbali", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: gem("emerald", "cabochon", "pear", 3, "Emerald drop"), accents: { gem: "diamond", cut: "polki", color: "#f4f6fb", sizeCt: 0.06 } } },
  { name: "Kundan choker", type: "necklace", style: "kundan-choker", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: diamond("cushion", 1.5, "Polki diamond", "polki"), enamel: { enabled: true, color: "#9b1630" } } },
  { name: "Rani haar with emerald", type: "necklace", style: "rani-haar", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: gem("emerald", "cabochon", "oval", 20, "Carved-look emerald"), fringe: { enabled: true, gem: "pearl", color: GEM_LOOK.pearl.color, sizeMm: 5 } } },
  { name: "Temple coin necklace", type: "necklace", style: "temple", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: gem("ruby", "cabochon", "oval", 3, "Ruby cabochon") } },
  { name: "Diamond riviera", type: "necklace", style: "riviera", patch: { metal: "white-gold", center: diamond("round", 0.5, "Round brilliant diamond") } },
  { name: "Polki kada", type: "bracelet", style: "kada", patch: { metal: "yellow-gold", purity: { karat: 22 }, accents: { gem: "diamond", cut: "polki", color: "#f4f6fb", sizeCt: 0.15 }, enamel: { enabled: true, color: "#1b3f8f" } } },
  { name: "Diamond tennis bracelet", type: "bracelet", style: "tennis", patch: { metal: "white-gold", accents: { gem: "diamond", cut: "faceted", color: "#f4f6fb", sizeCt: 0.1 } } },
  { name: "Bridal maang tikka", type: "headpiece", style: "maang-tikka", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: diamond("pear", 1.5, "Polki diamond", "polki"), accents: { gem: "emerald", color: GEM_LOOK.emerald.color, sizeCt: 0.05 } } },
  { name: "Bridal nath", type: "nose", style: "nath", patch: { metal: "yellow-gold", purity: { karat: 22 }, accents: { gem: "ruby", color: GEM_LOOK.ruby.color, sizeCt: 0.03 } } },
  { name: "Ghungroo payal", type: "anklet", style: "payal", patch: { metal: "oxidised-silver" } },
];
