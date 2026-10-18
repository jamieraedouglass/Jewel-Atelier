import { z } from "zod";
import { CUTS, GEM_LOOK, type Gem, SHAPES } from "./vocab";
import type { CenterStoneSchema, DropPartSchema, FrameIn } from "./schema";
import { varietiesOf, varietyLook } from "./varieties";

type PartIn = z.input<typeof DropPartSchema>;
const W_ = "#f4f6fb";
const dia = (shape: (typeof SHAPES)[number], lengthMm: number, widthMm: number, rotation = 0) => ({ gem: "diamond" as const, cut: "faceted" as const, shape, lengthMm, widthMm, domeMm: 0.8, color: W_, clarity: 0.95, rotation, dx: 0, dz: 0 });
const col = (gem: Gem, cut: (typeof CUTS)[number], shape: (typeof SHAPES)[number], lengthMm: number, widthMm: number, rotation = 0, color?: string) =>
  ({ gem, cut, shape, lengthMm, widthMm, domeMm: cut === "cabochon" ? widthMm * 0.4 : 0.8, color: color ?? GEM_LOOK[gem].color, clarity: GEM_LOOK[gem].clarity, rotation, dx: 0, dz: 0 });
const sm = (shapes: (typeof SHAPES)[number][], widthMm: number, rotation = 0, gem: Gem = "diamond", cut: (typeof CUTS)[number] = "faceted") => ({ gem, cut, color: GEM_LOOK[gem].color, shapes, widthMm, rotation });

const graded = (gem: Gem, grade: string, cut: (typeof CUTS)[number], shape: (typeof SHAPES)[number], lengthMm: number, widthMm: number, rotation = 0) => {
  const v = varietiesOf(gem).find((x) => x.id === grade);
  if (!v) throw new Error(`no ${grade} grade for ${gem}`);
  return { ...col(gem, cut, shape, lengthMm, widthMm, rotation), ...varietyLook(v) };
};
const pearl = (shape: (typeof SHAPES)[number], lengthMm: number, widthMm: number) => col("pearl", "bead", shape, lengthMm, widthMm);

export const KOTHARI = "Kothari's signatures";

export const DROP_PRESETS: { name: string; blurb: string; parts: PartIn[]; collection?: string }[] = [
  {
    name: "Fleur chandelier", blurb: "Marquise fleur top, a canary cushion with a marquise spray, three pear–round–pear strands and a big pear drop.",
    parts: [
      { kind: "stone", stone: dia("round", 4.2, 4.2), small: sm(["marquise"], 2.4), count: 3, arrange: "above", gapMm: 0 },
      { kind: "stone", stone: dia("round", 3.2, 3.2), small: sm(["round"], 1), gapMm: 0.8 },
      { kind: "stone", stone: col("diamond", "faceted", "cushion", 10, 9.5, 0, "#f6d23c"), halo: true, haloMm: 1.3, small: sm(["marquise"], 2.3), count: 6, arrange: "sides", gapMm: 0.8 },
      { kind: "strands", small: sm(["pear", "round", "pear"], 2.8, 180), count: 3, perStrand: 3, spreadMm: 17, curveMm: 3, gapMm: 0.6 },
      { kind: "stone", stone: dia("pear", 12, 8, 180), small: sm(["round"], 1), gapMm: 0.6 },
    ],
  },
  {
    name: "Tiered chandelier", blurb: "Classic tiers of small stones, each finished with pear drops.",
    parts: [
      { kind: "stone", stone: dia("round", 5, 5), small: sm(["round"], 1.2), halo: true, gapMm: 0 },
      { kind: "strands", small: sm(["pear"], 2.4, 180), count: 5, perStrand: 1, barStones: true, spreadMm: 12, curveMm: 2.5, gapMm: 1 },
      { kind: "strands", small: sm(["pear", "pear"], 2.6, 180), count: 7, perStrand: 2, barStones: true, spreadMm: 20, curveMm: 4, taper: "v", gapMm: 1 },
    ],
  },
  {
    name: "Emerald cabochon drop", blurb: "Asscher and baguette top with a haloed emerald cabochon pear.",
    parts: [
      { kind: "stone", stone: dia("asscher", 5, 5), halo: true, haloMm: 1.1, small: sm(["round"], 1.1), gapMm: 0 },
      { kind: "stone", stone: dia("baguette", 5, 2.2), small: sm(["round"], 1), gapMm: 0.5, link: "direct" },
      { kind: "stone", stone: col("emerald", "cabochon", "pear", 17, 12, 180), halo: true, haloMm: 1.3, small: sm(["round"], 1.3), gapMm: 0.6 },
    ],
  },
  {
    name: "Pear cluster with drops", blurb: "A cluster of emerald pears with diamond pears swinging below.",
    parts: [
      { kind: "stone", stone: dia("round", 3, 3), small: sm(["pear"], 4.2, 0, "emerald"), count: 5, arrange: "above", gapMm: 0 },
      { kind: "strands", small: sm(["pear"], 4, 180), count: 3, perStrand: 1, spreadMm: 9, curveMm: 3, gapMm: 0, link: "direct" },
    ],
  },
  {
    name: "Stacked hearts", blurb: "Graduated heart shapes, small to large.",
    parts: [
      { kind: "stone", stone: dia("heart", 4.5, 4.5), small: sm(["round"], 1), gapMm: 0 },
      { kind: "stone", stone: dia("heart", 5.5, 5.5), small: sm(["round"], 1), gapMm: 0.6 },
      { kind: "stone", stone: dia("heart", 11, 11), small: sm(["round"], 1), gapMm: 0.6 },
    ],
  },
  {
    name: "Ruby flower stud", blurb: "An oval ruby with diamond pear petals all round.",
    parts: [{ kind: "stone", stone: col("ruby", "faceted", "oval", 8, 6), small: sm(["pear"], 3, 0), count: 9, arrange: "around", gapMm: 0 }],
  },
  {
    name: "Aquamarine halo with leaves", blurb: "Aquamarine in a pear halo, with diamond pear leaves on top.",
    parts: [{ kind: "stone", stone: col("aquamarine", "faceted", "round", 9, 9), halo: true, haloMm: 1.8, haloShape: "pear", small: sm(["pear"], 3.4, 0), count: 2, arrange: "above", gapMm: 0 }],
  },
  {
    name: "Octagon frame drop", blurb: "A small pavé octagon frame and a large open octagon below.",
    parts: [
      { kind: "frame", stone: dia("octagon", 7, 7), showStone: false, halo: true, haloMm: 1.1, small: sm(["round"], 1.1), gapMm: 0 },
      { kind: "frame", stone: dia("octagon", 22, 19), showStone: false, halo: true, haloMm: 1.3, small: sm(["round"], 1.3), gapMm: 0.8 },
    ],
  },
  {
    name: "Pear with briolette fringe", blurb: "A pear stud with a fringe of briolettes underneath.",
    parts: [
      { kind: "stone", stone: dia("pear", 9, 6, 180), small: sm(["round"], 1), gapMm: 0 },
      { kind: "strands", small: sm(["pear"], 2.2, 180, "diamond", "briolette"), count: 7, perStrand: 1, spreadMm: 8, curveMm: 3, taper: "v", gapMm: 0, link: "direct" },
    ],
  },
  {
    name: "Twin side drops", blurb: "A haloed round top with a pair of pear drops swinging side by side, and a marquise between them.",
    parts: [
      { kind: "stone", stone: dia("round", 6, 6), halo: true, haloMm: 1.2, small: sm(["round"], 1.2), gapMm: 0 },
      { kind: "stone", stone: dia("pear", 10, 6.5, 180), small: sm(["round"], 1), gapMm: 3, link: "chain", offsetX: 5, tilt: 8, pair: true },
      { kind: "stone", stone: dia("marquise", 9, 4.5), small: sm(["round"], 1), gapMm: 0.8, from: 0 },
    ],
  },
  {
    name: "Asymmetric toi-et-moi drop", blurb: "A tilted pear with an emerald set beside it, and a single drop off to one side.",
    parts: [
      { kind: "stone", stone: dia("pear", 9, 6, 160), small: sm(["round"], 1), gapMm: 0 },
      { kind: "stone", stone: col("emerald", "faceted", "emerald", 8, 6, 0), small: sm(["round"], 1), anchor: "beside", side: "right", gapMm: 0.6, offsetZ: 2, tilt: -15, link: "direct" },
      { kind: "stone", stone: dia("pear", 7, 5, 180), small: sm(["round"], 1), gapMm: 1, from: 1 },
    ],
  },
  {
    name: "Ribbon bow", blurb: "A pavé bow with a baguette knot.",
    parts: [{ kind: "bow", stone: dia("baguette", 4, 2), halo: true, haloMm: 1.1, small: sm(["round"], 1.1), spreadMm: 18, gapMm: 0 }],
  },
  {
    name: "Bow with pear drop", blurb: "The pavé bow with a pear drop hanging from the knot.",
    parts: [
      { kind: "bow", stone: dia("baguette", 4, 2), halo: true, haloMm: 1.1, small: sm(["round"], 1.1), spreadMm: 18, gapMm: 0 },
      { kind: "stone", stone: dia("pear", 10, 7, 180), small: sm(["round"], 1), gapMm: 1 },
    ],
  },
  {
    name: "Kashi Kamal", collection: KOTHARI, blurb: "A pear emerald in a lotus of pear diamonds, with three pearl drops.",
    parts: [
      { kind: "stone", stone: dia("round", 3.2, 3.2), small: sm(["round"], 1), halo: true, haloMm: 1, gapMm: 0 },
      { kind: "stone", stone: graded("emerald", "colombian", "faceted", "pear", 12, 8.5, 180), small: sm(["pear"], 3, 0), count: 11, arrange: "around", gapMm: 0.6 },
      { kind: "stone", stone: pearl("pear", 12, 10), gapMm: 0.6 },
      { kind: "stone", stone: pearl("pear", 10, 8.5), from: 1, pair: true, offsetX: 10, offsetZ: -7, gapMm: 0.6 },
    ],
  },
  {
    name: "Ruby, emerald bead and pearl drop", collection: KOTHARI, blurb: "An oval ruby in a diamond cluster, a polished emerald bead, a diamond rondelle and a pearl drop.",
    parts: [
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "oval", 8, 6.5), halo: true, haloMm: 1.6, small: sm(["pear"], 2.6, 0), count: 2, arrange: "below", gapMm: 0 },
      { kind: "stone", stone: graded("emerald", "colombian", "bead", "round", 13, 13), gapMm: 0.5, link: "direct" },
      { kind: "stone", stone: dia("round", 2, 2), halo: true, haloMm: 1.4, small: sm(["round"], 1), gapMm: 0.3, link: "direct" },
      { kind: "stone", stone: pearl("round", 15, 14), gapMm: 0.3, link: "direct" },
    ],
  },
  {
    name: "Burmese ruby cluster chandelier", collection: KOTHARI, blurb: "Graduated oval rubies, each in a diamond halo with pear points, stacked into a long drop.",
    parts: [
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "oval", 6, 4.8), halo: true, haloMm: 1.2, gapMm: 0 },
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "oval", 7, 5.5), halo: true, haloMm: 1.3, small: sm(["pear"], 2, 0), count: 2, arrange: "sides", gapMm: 0.5, link: "direct" },
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "oval", 8, 6.2), halo: true, haloMm: 1.4, small: sm(["pear"], 2.2, 0), count: 2, arrange: "sides", gapMm: 0.5, link: "direct" },
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "oval", 9.5, 7.2), halo: true, haloMm: 1.5, small: sm(["pear"], 2.4, 0), count: 3, arrange: "below", gapMm: 0.5, link: "direct" },
    ],
  },
  {
    name: "Pear diamond cascade", collection: KOTHARI, blurb: "A round top and sprays of pear diamonds, ending in a large pear.",
    parts: [
      { kind: "stone", stone: dia("round", 4.5, 4.5), small: sm(["pear"], 3, 0), count: 4, arrange: "around", gapMm: 0 },
      { kind: "stone", stone: dia("pear", 6, 4, 0), small: sm(["pear"], 3.4, 0), count: 2, arrange: "sides", gapMm: 0.6 },
      { kind: "stone", stone: dia("pear", 7, 4.8, 0), small: sm(["pear"], 3.8, 0), count: 2, arrange: "sides", gapMm: 0.6 },
      { kind: "stone", stone: dia("pear", 13, 8.5, 0), gapMm: 0.6 },
    ],
  },
  {
    name: "Ruby and diamond leaf drop", collection: KOTHARI, blurb: "A cushion ruby in diamonds, a vine of pear diamond leaves, and a pear ruby at the tip.",
    parts: [
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "cushion", 7, 7), halo: true, haloMm: 1.4, gapMm: 0 },
      { kind: "stone", stone: dia("round", 2.4, 2.4), small: sm(["pear"], 3.6, 0), count: 2, arrange: "sides", gapMm: 0.5, link: "direct" },
      { kind: "stone", stone: dia("round", 2.2, 2.2), small: sm(["pear"], 3.3, 0), count: 2, arrange: "sides", gapMm: 0.5, link: "direct" },
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "pear", 10, 7, 0), gapMm: 0.5 },
    ],
  },
  {
    name: "Kite flower stud", collection: KOTHARI, blurb: "A round diamond in a star of kite-cut diamond petals.",
    parts: [{ kind: "stone", stone: dia("round", 5, 5), small: sm(["kite"], 2.6, 0), count: 12, arrange: "around", gapMm: 0 }],
  },
  {
    name: "Emerald ribbon flower", collection: KOTHARI, blurb: "A square emerald-cut emerald with loops of baguette diamonds round it, like a ribbon flower.",
    parts: [{ kind: "stone", stone: graded("emerald", "colombian", "faceted", "asscher", 8, 8), halo: true, haloMm: 1.1, haloShape: "baguette", small: sm(["marquise"], 3.4, 0), count: 8, arrange: "around", gapMm: 0 }],
  },
  {
    name: "Emerald bead tassel", collection: KOTHARI, blurb: "A haloed emerald cabochon with a tassel of emerald beads.",
    parts: [
      { kind: "stone", stone: graded("emerald", "colombian", "cabochon", "cushion", 10, 9), halo: true, haloMm: 1.3, gapMm: 0 },
      { kind: "strands", small: sm(["round"], 2.4, 0, "emerald", "bead"), count: 13, perStrand: 10, spreadMm: 10, curveMm: 1, taper: "even", gapMm: 0.4, link: "direct" },
    ],
  },
  {
    name: "Carved stone pendant", collection: KOTHARI, blurb: "A pavé bar, a carved aquamarine in claws, a diamond cap and a golden South Sea pearl.",
    parts: [
      { kind: "bow", showStone: false, halo: true, haloMm: 1, spreadMm: 26, small: sm(["round"], 1), gapMm: 0 },
      { kind: "stone", stone: { ...col("aquamarine", "carved", "cushion", 26, 19), domeMm: 6, clarity: 0.8 }, gapMm: 0.6, link: "direct" },
      { kind: "stone", stone: dia("round", 2.2, 2.2), halo: true, haloMm: 1.1, small: sm(["round"], 1), gapMm: 0.5, link: "direct" },
      { kind: "stone", stone: { ...pearl("pear", 16, 13.5), color: "#d8b46a" }, gapMm: 0.3, link: "direct" },
    ],
  },
  {
    name: "Carved jade drop", collection: KOTHARI, blurb: "A diamond stud with a carved jade drop, in the Mughal manner.",
    parts: [
      { kind: "stone", stone: dia("round", 4, 4), halo: true, haloMm: 1, gapMm: 0 },
      { kind: "stone", stone: { ...col("jade", "carved", "pear", 20, 14, 0), domeMm: 4.5 }, gapMm: 0.6 },
    ],
  },
  {
    name: "Rainbow sapphire line drop", collection: KOTHARI, blurb: "Oval sapphires in a line, orange through yellow and green to blue, each in a fine claw setting.",
    parts: ["#e2581c", "#f08a1e", "#f2b81e", "#d8c63a", "#8aa86a", "#6f8fb8", "#4f6fc0"].map((color, i) => ({
      kind: "stone" as const, stone: { ...col("sapphire", "faceted", "oval", 6 + i * 0.15, 4.6 + i * 0.1, 0, color), clarity: 0.6 }, gapMm: i ? 0.25 : 0, link: "direct" as const,
    })),
  },
  {
    name: "Briolette fringe drop", collection: KOTHARI, blurb: "An oval ruby in diamonds with a fringe of briolette diamonds.",
    parts: [
      { kind: "stone", stone: graded("ruby", "burmese", "faceted", "oval", 9, 7), halo: true, haloMm: 1.4, gapMm: 0 },
      { kind: "strands", small: sm(["pear"], 2.4, 180, "diamond", "briolette"), count: 9, perStrand: 1, spreadMm: 14, curveMm: 4, taper: "v", gapMm: 0, link: "direct" },
    ],
  },
];

const fr = (x: FrameIn) => x;
const look = (g: Gem) => ({ gem: g, color: GEM_LOOK[g].color });

export const FRAME_PRESETS: { name: string; blurb: string; frames: FrameIn[]; center?: Partial<z.input<typeof CenterStoneSchema>>; collection?: string }[] = [
  { name: "Hexagon ruby Deco", blurb: "Round diamond, a ring of calibré rubies, milgrain, then a hexagon of pavé.", frames: [
    fr({ kind: "milgrain" }), fr({ ...look("ruby"), shape: "princess", widthMm: 1.6, direction: "radial", outline: "round" }),
    fr({ kind: "milgrain", outline: "hexagon" }), fr({ outline: "hexagon", widthMm: 1.2 }), fr({ kind: "milgrain", outline: "hexagon" }) ] },
  { name: "Octagon ruby sunburst", blurb: "Calibré rubies fanning out to an octagon, with a pavé octagon border.", frames: [
    fr({ kind: "milgrain" }), fr({ ...look("ruby"), shape: "baguette", widthMm: 1.4, direction: "radial", outline: "octagon" }),
    fr({ kind: "metal", outline: "octagon", widthMm: 0.6 }), fr({ outline: "octagon", widthMm: 1.2 }), fr({ kind: "milgrain", outline: "octagon" }) ] },
  { name: "Emerald & turquoise Deco", blurb: "Emerald calibré and turquoise in an octagon, framed in pavé.", frames: [
    fr({ ...look("emerald"), shape: "baguette", widthMm: 1.4, outline: "octagon" }), fr({ ...look("turquoise"), cut: "cabochon", shape: "baguette", widthMm: 1.4, outline: "octagon" }),
    fr({ outline: "octagon", widthMm: 1.1 }), fr({ kind: "milgrain", outline: "octagon" }) ], center: { gem: "diamond", cut: "faceted", shape: "emerald", lengthMm: 8, widthMm: 6, domeMm: 1.2, color: "#f4f6fb", clarity: 0.95 } },
  { name: "Emerald scalloped halo", blurb: "A frill of small emeralds round an old-cut diamond, edged in milgrain.", frames: [
    fr({ kind: "milgrain" }), fr({ ...look("emerald"), widthMm: 1.6, outline: "round" }), fr({ ...look("emerald"), widthMm: 1.5, outline: "cushion" }), fr({ kind: "milgrain", outline: "cushion" }) ], center: { gem: "diamond", cut: "faceted", shape: "old-mine", lengthMm: 8, widthMm: 8, domeMm: 1.4, color: "#f4f6fb", clarity: 0.95 } },
  { name: "Sapphire petals", blurb: "Sapphire cabochon petals round a cushion diamond.", frames: [
    fr({ kind: "milgrain", outline: "cushion" }), fr({ ...look("sapphire"), cut: "cabochon", shape: "pear", widthMm: 1.8, direction: "radial", outline: "round" }),
    fr({ ...look("sapphire"), cut: "cabochon", shape: "pear", widthMm: 2, direction: "radial", outline: "round" }), fr({ kind: "milgrain" }) ], center: { gem: "diamond", cut: "faceted", shape: "cushion", lengthMm: 8, widthMm: 7.5, domeMm: 1.4, color: "#f4f6fb", clarity: 0.95 } },
  { name: "Sapphire & diamond stripes", blurb: "Sapphire calibré radiating in stripes with pavé diamond rays.", frames: [
    fr({ kind: "milgrain" }), fr({ ...look("sapphire"), shape: "baguette", widthMm: 1.5, direction: "radial", alt: { gem: "diamond", color: "#f4f6fb", shape: "round", cut: "faceted" }, every: 2 }),
    fr({ ...look("sapphire"), shape: "baguette", widthMm: 1.6, direction: "radial", alt: { gem: "diamond", color: "#f4f6fb", shape: "round", cut: "faceted" }, every: 2 }), fr({ kind: "milgrain" }) ] },
  { name: "Ballerina", blurb: "Tapered baguettes fanning out round a round diamond.", frames: [
    fr({ shape: "baguette", widthMm: 1.6, direction: "radial" }), fr({ shape: "baguette", widthMm: 1.8, direction: "radial", outline: "cushion" }) ], center: { gem: "diamond", cut: "faceted", shape: "round", lengthMm: 7, widthMm: 7, domeMm: 1.2, color: "#f4f6fb", clarity: 0.95 } },
  { name: "Ruby labyrinth", blurb: "Alternating bands of calibré rubies and pavé in a cushion shape.", frames: [
    fr({ kind: "milgrain" }), fr({ ...look("ruby"), shape: "princess", widthMm: 1.3, direction: "radial" }), fr({ outline: "cushion", widthMm: 1 }),
    fr({ ...look("ruby"), shape: "princess", widthMm: 1.3, outline: "cushion" }), fr({ outline: "cushion", widthMm: 1 }), fr({ kind: "milgrain", outline: "cushion" }) ] },
  { name: "Marquise mosaic", blurb: "A marquise diamond in a bombé of bands that hug it: pink sapphire cabochons with emerald leaves, edged in milgrain.", frames: [
    fr({ kind: "milgrain", outline: "marquise", fit: "hug", gapMm: 0 }),
    fr({ ...look("sapphire"), color: "#d9a6d6", cut: "cabochon", shape: "oval", widthMm: 2.2, direction: "radial", outline: "marquise", fit: "hug", gapMm: 0, alt: { gem: "emerald", color: "#0f8a52", shape: "marquise", cut: "cabochon" }, every: 2 }),
    fr({ kind: "milgrain", outline: "marquise", fit: "hug", gapMm: 0 }),
    fr({ ...look("sapphire"), color: "#d9a6d6", cut: "cabochon", shape: "oval", widthMm: 2.4, direction: "along", outline: "marquise", fit: "hug", gapMm: 0, alt: { gem: "emerald", color: "#0f8a52", shape: "marquise", cut: "cabochon" }, every: 3 }),
    fr({ ...look("sapphire"), color: "#d9a6d6", cut: "cabochon", shape: "oval", widthMm: 2.5, direction: "along", outline: "marquise", fit: "hug", gapMm: 0, alt: { gem: "emerald", color: "#0f8a52", shape: "marquise", cut: "cabochon" }, every: 2 }),
    fr({ kind: "milgrain", outline: "marquise", fit: "hug", gapMm: 0 }),
    fr({ ...look("sapphire"), color: "#d9a6d6", cut: "cabochon", shape: "oval", widthMm: 2.6, direction: "along", outline: "marquise", fit: "hug", gapMm: 0, alt: { gem: "emerald", color: "#0f8a52", shape: "marquise", cut: "cabochon" }, every: 3 }),
    ],
    center: { gem: "diamond", cut: "faceted", shape: "marquise", lengthMm: 13, widthMm: 6.5, domeMm: 1.2, color: "#f4f6fb", clarity: 0.95 } },
  { name: "Asscher in a pavé octagon", blurb: "A step-cut centre in two octagon rows of pavé.", frames: [
    fr({ outline: "octagon", widthMm: 1.1 }), fr({ kind: "milgrain", outline: "octagon" }), fr({ outline: "octagon", widthMm: 1.2 }), fr({ kind: "milgrain", outline: "octagon" }) ],
    center: { gem: "diamond", cut: "faceted", shape: "asscher", lengthMm: 7, widthMm: 7, domeMm: 1.2, color: "#f4f6fb", clarity: 0.95 } },
  { name: "Briolette halo", collection: KOTHARI, blurb: "A cushion emerald in a frame of baguettes, then a frill of briolette diamonds.", frames: [
    fr({ shape: "baguette", widthMm: 1.5, direction: "along", outline: "cushion" }), fr({ shape: "pear", cut: "briolette", widthMm: 2.4, direction: "radial", outline: "cushion" })],
    center: { ...graded("emerald", "colombian", "faceted", "cushion", 12, 11), label: "Colombian emerald" } },
  { name: "Emerald in pear-diamond petals", collection: KOTHARI, blurb: "An emerald-cut emerald ringed by pear diamonds, points out.", frames: [
    fr({ shape: "round", widthMm: 1.2, direction: "along", outline: "emerald" }), fr({ shape: "pear", widthMm: 2.8, direction: "radial", outline: "emerald" })],
    center: { ...graded("emerald", "colombian", "faceted", "emerald", 12, 9), label: "Colombian emerald" } },
];
