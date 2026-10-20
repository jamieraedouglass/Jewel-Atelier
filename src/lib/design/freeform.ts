import { z } from "zod";
import { CUTS, GEMS, SHAPES } from "./vocab";

// A freeform piece: any design described with a jeweller's building blocks rather than a style written in code.
// It is drawn flat, in millimetres, as seen from the front (a ring: from above, unrolled):
//   x runs across (0 is the centre line), y runs down (0 is where the piece is worn from: the neckline at the centre
//   front, the earlobe, the middle of a ring's top), h rises towards the viewer (doming).
// Lines are named paths through points; rows of stones, gold wires and plates follow them, and single stones sit at
// points. With `mirror`, everything is drawn for the right half (x >= 0) and copied to the left.

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const num = (min: number, max: number, def: number) => z.number().min(min).max(max).default(def);
const point = z.tuple([z.number().min(-600).max(600), z.number().min(-600).max(600)]).or(z.tuple([z.number().min(-600).max(600), z.number().min(-600).max(600), z.number().min(-20).max(20)]));
const ref = z.string().min(1).max(24);

const Look = {
  gem: z.enum(GEMS).default("diamond"),
  color: hex.default("#f4f6fb"),
  cut: z.enum(CUTS).default("faceted"),
  shape: z.enum(SHAPES).default("round"),
};
// A part can be repeated round a point (a rosette of petals, a star of rays), or, given a step, in a line (the links
// of a band, a row of motifs), each copy `scale` times the last so a band can graduate towards the back. A line of
// copies shrinks about `around` (give every part of one motif the same point, so the motif shrinks as one).
const Repeat = z.object({
  count: z.number().int().min(2).max(24),
  around: point.optional(),
  step: z.tuple([z.number().min(-80).max(80), z.number().min(-80).max(80)]).optional(),
  scale: num(0.7, 1.3, 1),
}).optional();

export const FreeformPathSchema = z.object({
  id: ref,
  points: z.array(point).min(2).max(48),
  closed: z.boolean().default(false),
  // Straight lines between the points with crisp corners (geometric gold work), instead of a smooth curve through them.
  sharp: z.boolean().default(false),
});

const RowPart = z.object({
  kind: z.literal("row"),
  path: ref,
  from: num(0, 1, 0), to: num(0, 1, 1),
  ...Look,
  sizeMm: num(0.6, 25, 2),
  sizeEndMm: z.number().min(0.6).max(25).optional(),
  set: z.enum(["along", "across"]).default("along"),
  rows: z.number().int().min(1).max(6).default(1),
  gapMm: num(0, 6, 0.2),
  repeat: Repeat,
});
const WirePart = z.object({
  kind: z.literal("wire"),
  path: ref,
  from: num(0, 1, 0), to: num(0, 1, 1),
  widthMm: num(0.4, 4, 0.9),
  finish: z.enum(["plain", "milgrain", "rope"]).default("plain"),
  repeat: Repeat,
});
const PlatePart = z.object({
  kind: z.literal("plate"),
  path: ref,
  holes: z.array(ref).max(12).default([]),
  thicknessMm: num(0.5, 4, 1.2),
  domeMm: num(0, 8, 0),
  pave: z.object({ ...Look, sizeMm: num(0.7, 4, 1.3) }).optional(),
  edge: z.enum(["plain", "milgrain"]).default("plain"),
  repeat: Repeat,
});
const StonePart = z.object({
  kind: z.literal("stone"),
  at: point,
  ...Look,
  lengthMm: num(1, 40, 6),
  widthMm: num(1, 40, 6),
  rotation: num(-180, 180, 0),
  setting: z.enum(["claw", "bezel"]).default("claw"),
  repeat: Repeat,
});
const LinkPart = z.object({
  kind: z.literal("link"),
  a: point, b: point,
  // free: jump rings, so what hangs from it swings (a briolette drop); otherwise a solid bail, held still.
  free: z.boolean().default(false),
  repeat: Repeat,
});
export const FreeformPartSchema = z.discriminatedUnion("kind", [RowPart, WirePart, PlatePart, StonePart, LinkPart]);

export const FreeformSchema = z.object({
  name: z.string().max(80).default("Garland pendant"),
  notes: z.string().max(1200).default(""),
  mirror: z.boolean().default(true),
  // Necklaces: what goes round the neck. Earrings: how it's worn.
  // "none": the drawing itself goes all the way round (a choker or collar whose pattern runs to the clasp).
  neckline: z.object({ kind: z.enum(["chain", "stones", "none"]).default("chain"), ...Look, sizeMm: num(1, 8, 2.4), rows: z.number().int().min(1).max(3).default(1) }).default({}),
  top: z.enum(["post", "hook"]).default("post"),
  paths: z.array(FreeformPathSchema).max(40).default([
    { id: "garland", points: [[0, 6], [8, 9], [15, 4]], closed: false },
  ]),
  parts: z.array(FreeformPartSchema).max(60).default([
    { kind: "link", a: [0, 0], b: [0, 6.5] },
    { kind: "stone", at: [0, 11.2], gem: "diamond", color: "#f4f6fb", cut: "faceted", shape: "pear", lengthMm: 9, widthMm: 6, rotation: 0, setting: "claw" },
    { kind: "row", path: "garland", from: 0, to: 1, gem: "diamond", color: "#f4f6fb", cut: "faceted", shape: "round", sizeMm: 2, sizeEndMm: 1.4, set: "along", rows: 1, gapMm: 0.2 },
  ]),
});

export type Freeform = z.infer<typeof FreeformSchema>;
export type FreeformPart = z.infer<typeof FreeformPartSchema>;
export type FreeformPath = z.infer<typeof FreeformPathSchema>;
