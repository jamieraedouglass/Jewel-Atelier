import { z } from "zod";
import { BAND_FINISHES, BANGLE_SIZES, CHAIN_STYLES, CUTS, GEMS, METALS, SETTINGS, SHAPES, SIDE_KINDS } from "./vocab";
import { TYPES, firstStyle, hasStyle } from "./styles";
import { DROP_PRESETS, FRAME_PRESETS } from "./presets";

/**
 * A design (any piece of jewellery) is one plain JSON object. It is what the 3D model renders,
 * what gets saved to the database, what Claude reads, and what Claude proposes changes to.
 * Every field has a default, so partial updates are always safe.
 */

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
  gem: z.enum(GEMS).default("diamond"),
  cut: z.enum(CUTS).default("faceted"),
  shape: z.enum(SHAPES).default("round"),
  carat: z.number().min(0.01).max(200).nullable().default(null),
  lengthMm: z.number().min(1).max(40).default(6.5),
  widthMm: z.number().min(1).max(40).default(6.5),
  /** height above the girdle: dome height for a cabochon, crown height for a faceted stone */
  domeMm: z.number().min(0.2).max(15).default(1),
  color: hex.default("#f4f6fb"),
  /** 0 = opaque, 1 = water-clear */
  clarity: z.number().min(0).max(1).default(0.95),
  /** 0–1: how lit-from-within the stone looks (fluorescence, saturation), as with a Burmese ruby; see varieties.ts */
  glow: z.number().min(0).max(1).default(0),
  label: z.string().max(120).default("Round diamond"),
  photoPath: z.string().nullable().default(null),
  /** no main stone at all: a plain band, plain hoops, a bare chain */
  none: z.boolean().default(false),
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
  /** 0–1: how lit-from-within the stone looks (fluorescence, saturation), as with a Burmese ruby; see varieties.ts */
  glow: z.number().min(0).max(1).default(0),
  rotation: z.number().min(-180).max(180).default(0),
  /** nudge from its automatic spot, mm */
  dx: z.number().min(-30).max(30).default(0),
  dz: z.number().min(-30).max(30).default(0),
});
export type ExtraStone = z.infer<typeof ExtraStoneSchema>;

/* ---------------- drops, chandeliers and pendants, built part by part ---------------- */

/**
 * stone: one stone, with an optional halo and petals or leaves around it (flowers, clusters, sprays).
 * strands: a bar with strands of stones hanging from it (chandelier strands, briolette fringes, tiers).
 * frame: an open gold outline (octagon, pear, round...), plain or set with stones.
 * bow: a ribbon bow set with small stones, with an optional stone in the knot.
 */
export const DROP_KINDS = ["stone", "strands", "frame", "bow"] as const;
export const DROP_ARRANGE = ["around", "above", "below", "sides"] as const;

export const DropPartSchema = z.object({
  kind: z.enum(DROP_KINDS).default("stone"),
  /** the part's own stone: the centre of a cluster, the stone in a bow's knot, the stone inside a frame */
  stone: ExtraStoneSchema.default({}),
  showStone: z.boolean().default(true),
  /** the small stones: petals and leaves, halo, strand stones, the stones set on a frame or bow */
  small: z.object({
    gem: z.enum(GEMS).default("diamond"),
    cut: z.enum(CUTS).default("faceted"),
    color: hex.default("#f4f6fb"),
    /** shapes in repeating order, e.g. pear, round, pear down a strand */
    shapes: z.array(z.enum(SHAPES)).min(1).max(8).default(["pear"]),
    widthMm: z.number().min(0.8).max(20).default(3),
    /** turn each small stone, degrees (pears: 0 points outward or down, 180 points inward or up) */
    rotation: z.number().min(-180).max(180).default(0),
    /** an extra turn for each stone in the shape order, degrees, so some point one way and some another */
    turns: z.array(z.number().min(-180).max(180)).max(8).default([]),
  }).default({}),
  /** petals / leaves around a stone, strands under a bar */
  count: z.number().int().min(0).max(24).default(0),
  /** where petals sit around the stone */
  arrange: z.enum(DROP_ARRANGE).default("around"),
  /** a ring of small stones around the stone, or stones set on the frame / bow */
  halo: z.boolean().default(false),
  /** shape of the halo / frame / bow stones */
  haloShape: z.enum(SHAPES).default("round"),
  /** width of each halo / frame / bow stone, mm */
  haloMm: z.number().min(0.6).max(6).default(1.3),
  /** strands: stones in each strand */
  perStrand: z.number().int().min(1).max(10).default(3),
  /** strands: longest in the middle (v), at the sides (u), or all the same */
  taper: z.enum(["even", "v", "u"]).default("even"),
  /** strands: leave the middle strand out so a bigger drop can hang there */
  openMiddle: z.boolean().default(false),
  /** strands: small stones along the bar too */
  barStones: z.boolean().default(false),
  /** strands: width of the bar; bow: width of the bow; frame: space between frame and stone */
  spreadMm: z.number().min(0).max(70).default(12),
  /** strands: how much the bar curves down in the middle */
  curveMm: z.number().min(0).max(20).default(2),
  /** space above this part, and what joins it to the part above */
  gapMm: z.number().min(0).max(40).default(1),
  link: z.enum(["ring", "chain", "direct"]).default("ring"),
  /** layout: hang below a part, or sit beside it (side by side, asymmetric clusters) */
  anchor: z.enum(["below", "beside"]).default("below"),
  /** which part it hangs from or sits beside (0-based); -1 = the part just above in the list */
  from: z.number().int().min(-1).max(9).default(-1),
  /** sitting beside: on which side */
  side: z.enum(["left", "right"]).default("right"),
  /** nudge from its automatic spot, mm (sideways, down) */
  offsetX: z.number().min(-40).max(40).default(0),
  offsetZ: z.number().min(-40).max(40).default(0),
  /** tilt the whole part, degrees */
  tilt: z.number().min(-90).max(90).default(0),
  /** a mirrored twin on the other side (e.g. two side drops) */
  pair: z.boolean().default(false),
});
export type DropPart = z.infer<typeof DropPartSchema>;

export const FRAME_KINDS = ["stones", "milgrain", "metal"] as const;
export const FrameSchema = z.object({
  /** a layer of stones, a fine beaded (milgrain) border, or a plain gold band */
  kind: z.enum(FRAME_KINDS).default("stones"),
  /** the shape of this layer: round, octagon, hexagon, cushion, oval, emerald... */
  outline: z.enum(SHAPES).default("round"),
  gem: z.enum(GEMS).default("diamond"),
  color: hex.default("#f4f6fb"),
  cut: z.enum(CUTS).default("faceted"),
  /** stone shape: round for pavé, princess or baguette for calibré, pear or oval for petals */
  shape: z.enum(SHAPES).default("round"),
  widthMm: z.number().min(0.6).max(8).default(1.3),
  /** stones lie along the layer, or point out from the centre (ballerina baguettes, petals, calibré) */
  direction: z.enum(["along", "radial"]).default("along"),
  /** a second gem in stripes: after `every` stones of the first gem comes one of this */
  alt: z.object({ gem: z.enum(GEMS), color: hex, shape: z.enum(SHAPES), cut: z.enum(CUTS).default("faceted") }).nullable().default(null),
  every: z.number().int().min(1).max(8).default(1),
  gapMm: z.number().min(0).max(4).default(0.25),
});
export type Frame = z.infer<typeof FrameSchema>;
export type FrameIn = z.input<typeof FrameSchema>;
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
      /** accent stones on or off; off leaves the main stone and the metal (for styles with a main stone) */
      enabled: z.boolean().default(true),
      /** 0–1: lit-from-within look for the accent stones (see varieties.ts) */
      glow: z.number().min(0).max(1).default(0),
      /** stone shapes in repeating order, e.g. ["round", "round", "round", "marquise"] (tennis styles) */
      shapes: z.array(z.enum(SHAPES)).min(1).max(12).default(["round"]),
      /** which way elongated stones point: along the line, across it, or alternating */
      orientation: z.enum(["along", "across", "alternate"]).default("along"),
      /** extra turn for each stone in the pattern, degrees, matching shapes by position (e.g. rounds 0, marquise 90) */
      turns: z.array(z.number().min(-180).max(180)).max(12).default([]),
      /** a pair of stones side by side at this spot in the pattern (e.g. twin baguettes between rounds) */
      twins: z.array(z.boolean()).max(12).default([]),
      /** size of each stone in the pattern, as a multiple of the base size (e.g. a big round, a small round, a baguette) */
      sizes: z.array(z.number().min(0.2).max(4)).max(12).default([]),
      /** a colour for each stone in turn, repeating (rainbows, ombrés, two-tone); empty = all one colour */
      colors: z.array(hex).max(60).default([]),
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
    sides: z.object({
      kind: z.enum(SIDE_KINDS).default("half-moon"), sizeCt: z.number().min(0.05).max(3).default(0.5),
      /** sized to the centre stone and set tight against it, so they wrap it (rather than a separate carat size) */
      hug: z.boolean().default(true),
      /** how much of the centre stone's side they cover when hugging */
      hugFrac: z.number().min(0.4).max(1).default(0.78),
      /** level: up beside the centre stone; band: curving down with the band, set flush into its surface */
      follow: z.enum(["level", "band"]).default("level"),
    }).default({}),
    /**
     * stones under the centre stone's head: roseCut switches them on; `under` is two rose-cuts peeking out at the ends
     * (peekaboo) or a whole row of small stones round the gallery (a hidden halo)
     */
    gallery: z.object({ roseCut: z.boolean().default(true), under: z.enum(["peekaboo", "hidden-halo"]).default("peekaboo") }).default({}),
    band: z.object({
      widthMm: z.number().min(1.5).max(16).default(2.3), finish: z.enum(BAND_FINISHES).default("polished"),
      /** the design sits up on top of the band, low on it, or set into a band that widens to hold it */
      profile: z.enum(["raised", "low", "set-in", "flush"]).default("raised"),
      /** classic (rounded, a little heavier under the head), flat (flat top, square edges), or cigar (wide, domed, even) */
      shape: z.enum(["classic", "flat", "cigar"]).default("classic"),
      /** stones running down the band from the head: none, the shoulders, half way, or all the way round */
      pave: z.enum(["none", "shoulders", "half", "full"]).default("none"),
      paveRows: z.number().int().min(1).max(4).default(1),
      paveGem: z.enum(GEMS).default("diamond"),
      paveColor: hex.default("#f4f6fb"),
      paveShape: z.enum(SHAPES).default("round"),
      paveMm: z.number().min(0.8).max(4).default(1.5),
      /** a vine: stones angled alternately left and right by this many degrees (marquise leaves), 0 = in a line */
      paveAngle: z.number().min(0).max(80).default(0),
    }).default({}),
    ringSize: z.number().min(3).max(13).default(6.5),
    /** more stones in each stud (toi-et-moi, clusters), stacked below the main stone */
    extraStones: z.array(ExtraStoneSchema).max(6).default([]),
    /** drops, chandeliers and drop pendants, built part by part from the top down */
    drop: z.object({
      parts: z.array(DropPartSchema).min(1).max(10).default(DROP_PRESETS[0].parts),
      /** earrings: a stud post behind the top part, or a hook above it */
      top: z.enum(["post", "hook"]).default("post"),
    }).default({}),
    /** Art Deco / layered halo styles: the layers around the centre stone, inside out */
    frames: z.array(FrameSchema).max(8).default(FRAME_PRESETS[0].frames),
    /** earrings: null = a matching pair (one design for both); otherwise the right earring's own design */
    rightEar: z.record(z.unknown()).nullable().default(null),
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
        /** hoops: round, a tall oval, or a long paperclip */
        hoopShape: z.enum(["round", "oval", "paperclip"]).default("round"),
        /** gold collar link: crossed X links with pavé, or chevrons with stone rows */
        linkStyle: z.enum(["x", "chevron"]).default("x"),
        /**
         * how a pendant is worn: set into the chain as links of it (in-chain), sitting just under the chain (on-chain),
         * hanging below from a bail in a row (below), or one stone below another (drop)
         */
        hang: z.enum(["on-chain", "in-chain", "below", "drop"]).default("on-chain"),
        /** half-flower ring: flowers at the stone's ends along the finger, or at its sides along the band */
        flowerPlace: z.enum(["finger", "band"]).default("finger"),
        /** hoops: how far the stones run (front two-thirds, bottom half, or all the way up to the hinge) */
        paveCoverage: z.enum(["front", "half", "full"]).default("front"),
        /** hoops: which face of the wire the stones sit on — the narrow front edge, the wide outer side, or inside */
        hoopFace: z.enum(["front", "outer", "inner"]).default("front"),
        /** hoops: turn the charm, degrees (0 faces forward, 90 faces sideways) */
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
