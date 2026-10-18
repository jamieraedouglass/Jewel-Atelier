import { z } from "zod";
import { BAND_FINISHES, BANGLE_SIZES, CHAIN_STYLES, CUTS, GEMS, METALS, SETTINGS, SHAPES, SIDE_KINDS } from "./vocab";
import { TYPES, firstStyle, hasStyle } from "./styles";
import { DROP_PRESETS, FRAME_PRESETS } from "./presets";
import { DIAMOND_GRADE_IDS, PHENOMENA } from "./character";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const SAMPLE_MOTIF_PATH =
  "M45 95 C18 92 8 65 18 45 C28 25 50 22 60 12 C66 6 70 2 76 4 C83 7 83 15 77 19 C72 22 67 18 70 14 C65 27 81 41 83 59 C86 81 68 97 45 95 Z";

const svgPath = z.string().max(60000).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]*$/, "Only SVG path commands are allowed");

export const MotifStoneSchema = z.object({
  x: z.number(), y: z.number(), r: z.number().positive(),
  kind: z.enum(["center", "accent"]).default("accent"),
});

export const MotifSchema = z.object({
  name: z.string().max(80).default("Paisley (kairi)"),
  path: svgPath.default(SAMPLE_MOTIF_PATH),
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
  gem: z.enum(GEMS).default("diamond"),
  cut: z.enum(CUTS).default("faceted"),
  shape: z.enum(SHAPES).default("round"),
  carat: z.number().min(0.01).max(200).nullable().default(null),
  lengthMm: z.number().min(1).max(40).default(6.5),
  widthMm: z.number().min(1).max(40).default(6.5),
  domeMm: z.number().min(0.2).max(15).default(1),
  color: hex.default("#f4f6fb"),
  clarity: z.number().min(0).max(1).default(0.95),
  glow: z.number().min(0).max(1).default(0),
  label: z.string().max(120).default("Round diamond"),
  photoPath: z.string().nullable().default(null),
  none: z.boolean().default(false),
  rotation: z.number().min(-180).max(180).default(0),
  inclusions: z.number().min(0).max(1).default(0),
  phenomenon: z.enum(PHENOMENA).default("none"),
  rays: z.union([z.literal(4), z.literal(6), z.literal(12)]).default(6),
  colorGrade: z.enum(DIAMOND_GRADE_IDS).nullable().default(null),
});

export const ExtraStoneSchema = z.object({
  gem: z.enum(GEMS).default("diamond"),
  cut: z.enum(CUTS).default("faceted"),
  shape: z.enum(SHAPES).default("pear"),
  lengthMm: z.number().min(1).max(30).default(7),
  widthMm: z.number().min(1).max(30).default(5),
  domeMm: z.number().min(0.2).max(12).default(0.8),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#f4f6fb"),
  clarity: z.number().min(0).max(1).default(0.95),
  glow: z.number().min(0).max(1).default(0),
  rotation: z.number().min(-180).max(180).default(0),
  dx: z.number().min(-30).max(30).default(0),
  dz: z.number().min(-30).max(30).default(0),
});
export type ExtraStone = z.infer<typeof ExtraStoneSchema>;

const relativeSizes = (v: unknown) => {
  if (!Array.isArray(v) || !v.length || !v.every((x) => typeof x === "number" && x > 0)) return v;
  const top = Math.max(...(v as number[]));
  return top < 0.3 ? (v as number[]).map((x) => Math.round((x / top) * 100) / 100) : v;
};

export const DROP_KINDS = ["stone", "strands", "frame", "bow"] as const;
export const DROP_ARRANGE = ["around", "above", "below", "sides"] as const;

export const DropPartSchema = z.object({
  kind: z.enum(DROP_KINDS).default("stone"),
  stone: ExtraStoneSchema.default({}),
  showStone: z.boolean().default(true),
  small: z.object({
    gem: z.enum(GEMS).default("diamond"),
    cut: z.enum(CUTS).default("faceted"),
    color: hex.default("#f4f6fb"),
    shapes: z.array(z.enum(SHAPES)).min(1).max(8).default(["pear"]),
    widthMm: z.number().min(0.8).max(20).default(3),
    rotation: z.number().min(-180).max(180).default(0),
    turns: z.array(z.number().min(-180).max(180)).max(8).default([]),
    sizes: z.preprocess(relativeSizes, z.array(z.number().min(0.3).max(3)).max(8)).default([]),
  }).default({}),
  count: z.number().int().min(0).max(24).default(0),
  arc: z.object({ centerDeg: z.number().min(-180).max(180).default(90), spanDeg: z.number().min(10).max(360).default(120) }).nullable().default(null),
  arrange: z.enum(DROP_ARRANGE).default("around"),
  halo: z.boolean().default(false),
  haloShape: z.enum(SHAPES).default("round"),
  haloMm: z.number().min(0.6).max(6).default(1.3),
  perStrand: z.number().int().min(1).max(10).default(3),
  taper: z.enum(["even", "v", "u"]).default("even"),
  openMiddle: z.boolean().default(false),
  barStones: z.boolean().default(false),
  spreadMm: z.number().min(0).max(70).default(12),
  curveMm: z.number().min(0).max(20).default(2),
  gapMm: z.number().min(0).max(40).default(1),
  link: z.enum(["ring", "chain", "direct"]).default("ring"),
  anchor: z.enum(["below", "beside", "on"]).default("below"),
  from: z.number().int().min(-1).max(9).default(-1),
  side: z.enum(["left", "right"]).default("right"),
  offsetX: z.number().min(-40).max(40).default(0),
  offsetZ: z.number().min(-40).max(40).default(0),
  tilt: z.number().min(-90).max(90).default(0),
  pair: z.boolean().default(false),
  setting: z.enum(["auto", ...SETTINGS]).default("auto"),
});
export type DropPart = z.infer<typeof DropPartSchema>;

export const FRAME_KINDS = ["stones", "milgrain", "metal", "fill"] as const;
export const FrameSchema = z.object({
  kind: z.enum(FRAME_KINDS).default("stones"),
  outline: z.enum(SHAPES).default("round"),
  gem: z.enum(GEMS).default("diamond"),
  color: hex.default("#f4f6fb"),
  cut: z.enum(CUTS).default("faceted"),
  shape: z.enum(SHAPES).default("round"),
  widthMm: z.number().min(0.6).max(8).default(1.3),
  direction: z.enum(["along", "radial"]).default("along"),
  alt: z.object({ gem: z.enum(GEMS), color: hex, shape: z.enum(SHAPES), cut: z.enum(CUTS).default("faceted") }).nullable().default(null),
  every: z.number().int().min(1).max(8).default(1),
  gapMm: z.number().min(0).max(4).default(0.25),
  ratio: z.number().min(0.4).max(2.5).nullable().default(null),
  pattern: z.enum(["even", "vines"]).default("even"),
  fit: z.enum(["scale", "hug", "point"]).default("scale"),
  vary: z.number().min(0).max(0.4).default(0),
});
export type Frame = z.infer<typeof FrameSchema>;
export type FrameIn = z.input<typeof FrameSchema>;
export const DesignSchema = z
  .object({
    type: z.enum(TYPES).default("ring"),
    style: z.string().default("three-stone"),
    name: z.string().max(80).default("Untitled piece"),
    mood: z.string().max(80).default(""),
    center: CenterStoneSchema.default({}),
    accents: z.object({
      gem: z.enum(GEMS).default("diamond"), color: hex.default("#f4f6fb"), cut: z.enum(["faceted", "polki", "rose-cut"]).default("faceted"),
      sizeCt: z.number().min(0.005).max(6).default(0.1),
      enabled: z.boolean().default(true),
      glow: z.number().min(0).max(1).default(0),
      shapes: z.array(z.enum(SHAPES)).min(1).max(12).default(["round"]),
      orientation: z.enum(["along", "across", "alternate"]).default("along"),
      turns: z.array(z.number().min(-180).max(180)).max(12).default([]),
      twins: z.array(z.boolean()).max(12).default([]),
      sizes: z.array(z.number().min(0.2).max(4)).max(12).default([]),
      colors: z.array(hex).max(60).default([]),
      ombre: z.array(hex).max(6).default([]),
      layout: z.enum(["line", "wave", "garland"]).default("line"),
    }).default({}),
    fringe: z.object({ enabled: z.boolean().default(false), gem: z.enum(GEMS).default("pearl"), color: hex.default("#f3ede2"), sizeMm: z.number().min(1.5).max(14).default(4) }).default({}),
    enamel: z.object({ enabled: z.boolean().default(false), color: hex.default("#16704c") }).default({}),
    metal: z.enum(METALS).default("white-gold"),
    purity: z.object({ karat: z.union([z.literal(14), z.literal(18), z.literal(22), z.literal(24)]).default(18) }).default({}),
    setting: z.object({ style: z.enum(SETTINGS).default("double-claw"), height: z.number().min(0).max(1).default(0.1) }).default({}),
    sides: z.object({
      kind: z.enum(SIDE_KINDS).default("half-moon"), sizeCt: z.number().min(0.05).max(3).default(0.5),
      hug: z.boolean().default(true),
      hugFrac: z.number().min(0.4).max(1).default(0.78),
      follow: z.enum(["level", "band"]).default("level"),
    }).default({}),
    gallery: z.object({ roseCut: z.boolean().default(true), under: z.enum(["peekaboo", "hidden-halo"]).default("peekaboo"), color: hex.default("#f4f6fb") }).default({}),
    band: z.object({
      widthMm: z.number().min(1.5).max(16).default(2.3), finish: z.enum(BAND_FINISHES).default("polished"),
      profile: z.enum(["raised", "low", "set-in", "flush"]).default("raised"),
      shape: z.enum(["classic", "flat", "cigar"]).default("classic"),
      pave: z.enum(["none", "shoulders", "half", "full"]).default("none"),
      paveRows: z.number().int().min(1).max(4).default(1),
      paveGem: z.enum(GEMS).default("diamond"),
      paveColor: hex.default("#f4f6fb"),
      paveShape: z.enum(SHAPES).default("round"),
      paveMm: z.number().min(0.8).max(4).default(1.5),
      paveAngle: z.number().min(0).max(80).default(0),
      paveOmbre: z.array(hex).max(6).default([]),
      split: z.number().min(0).max(8).default(0),
    }).default({}),
    ringSize: z.number().min(3).max(13).default(6.5),
    extraStones: z.array(ExtraStoneSchema).max(6).default([]),
    stoneEdits: z.array(z.object({
      key: z.string().max(40),
      gem: z.enum(GEMS).optional(), color: hex.optional(), cut: z.enum(CUTS).optional(), shape: z.enum(SHAPES).optional(),
      scale: z.number().min(0.4).max(2.5).optional(),
    })).max(300).default([]),
    drop: z.object({
      parts: z.array(DropPartSchema).min(1).max(10).default(DROP_PRESETS[0].parts),
      top: z.enum(["post", "hook"]).default("post"),
    }).default({}),
    frames: z.array(FrameSchema).max(8).default(FRAME_PRESETS[0].frames),
    rightEar: z.record(z.unknown()).nullable().default(null),
    mirrorPair: z.boolean().default(true),
    motif: MotifSchema.default({}),
    options: z
      .object({
        halo: z.boolean().default(false),
        accentTop: z.boolean().default(true),
        pave: z.boolean().default(true),
        hoopDiameterMm: z.number().min(8).max(70).default(22),
        hoopShape: z.enum(["round", "oval", "paperclip"]).default("round"),
        linkStyle: z.enum(["x", "chevron"]).default("x"),
        hang: z.enum(["on-chain", "in-chain", "below", "drop"]).default("on-chain"),
        clasp: z.enum(["auto", "box", "jewelled", "hidden", "lobster", "spring-ring", "toggle"]).default("auto"),
        flowerPlace: z.enum(["finger", "band"]).default("finger"),
        pairSpacing: z.enum(["apart", "touching"]).default("apart"),
        decoDome: z.number().min(0).max(1).default(0),
        decoWrap: z.boolean().default(false),
        decoBend: z.number().min(0).max(1).default(0),
        decoSpread: z.number().min(0).max(1).default(0),
        decoLengthMm: z.number().min(0).max(60).default(0),
        decoWidthMm: z.number().min(0).max(60).default(0),
        lighting: z.enum(["studio", "daylight", "warm"]).default("studio"),
        stoneLink: z.enum(["bezel", "drilled"]).default("bezel"),
        paveCoverage: z.enum(["front", "half", "full"]).default("front"),
        hoopFace: z.enum(["front", "outer", "inner"]).default("front"),
        charmTurn: z.number().min(-180).max(180).default(0),
        lengthIn: z.number().min(12).max(40).default(18),
        wristCm: z.number().min(13).max(24).default(16.5),
        bangleSize: z.enum(BANGLE_SIZES).default("2-6"),
        chain: z.enum(CHAIN_STYLES).default("cable"),
        count: z.number().int().min(1).max(80).default(7),
        layers: z.number().int().min(1).max(7).default(3),
      })
      .default({}),
  })
  .transform((d) => (hasStyle(d.type, d.style) ? d : { ...d, style: firstStyle(d.type) }));

export type CenterStone = z.infer<typeof CenterStoneSchema>;
export type Design = z.output<typeof DesignSchema>;

export const defaultDesign = (): Design => DesignSchema.parse({});
