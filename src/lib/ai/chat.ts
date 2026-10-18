import Anthropic from "@anthropic-ai/sdk";
import { ALL_STYLES, BANGLE_SIZES, BAND_FINISHES, CHAIN_STYLES, CUTS, DROP_ARRANGE, DROP_KINDS, GEMS, METALS, SETTINGS, SHAPES, SIDE_KINDS, STYLES, TYPES, TYPE_LABEL, GEM_VARIETIES } from "../design";

export const STYLE_GUIDE = TYPES.map((t) => `${t} (${TYPE_LABEL[t]}): ${Object.entries(STYLES[t]).map(([k, s]) => `${k} — ${s.blurb}`).join("; ")}`).join("\n");

const gemProp = { type: "string", enum: [...GEMS] };
const hexProp = { type: "string", description: "#rrggbb" };
const glowProp = { type: "number", minimum: 0, maximum: 1, description: "0–1, how lit-from-within the stone looks (see COLOUR GRADES)" };

const GRADE_GUIDE = Object.entries(GEM_VARIETIES).map(([gem, vs]) =>
  `${gem}: ${(vs ?? []).map((v) => `${v.name} ${v.color} clarity ${v.clarity} glow ${v.glow} (${v.blurb})`).join("; ")}`).join("\n");
export const designPatchSchema = {
  type: "object",
  description: "Only the fields to change. Omit everything that should stay the same. To change the piece type or style, set both type and style.",
  properties: {
    name: { type: "string" },
    type: { type: "string", enum: [...TYPES] },
    style: { type: "string", enum: ALL_STYLES, description: `Must belong to the type. ${STYLE_GUIDE}` },
    center: { type: "object", properties: { gem: gemProp, cut: { type: "string", enum: [...CUTS] }, shape: { type: "string", enum: [...SHAPES] }, color: hexProp, clarity: { type: "number", minimum: 0, maximum: 1, description: "0 opaque … 1 water-clear" }, glow: glowProp, lengthMm: { type: "number" }, widthMm: { type: "number" }, rotation: { type: "number", description: "degrees the stone is turned in its setting" } } },
    extraStones: {
      type: "array",
      description: "studs only: further stones stacked below the main stone (toi-et-moi, clusters). Replaces the whole list.",
      items: { type: "object", properties: { gem: gemProp, cut: { type: "string", enum: [...CUTS] }, shape: { type: "string", enum: [...SHAPES] }, lengthMm: { type: "number" }, widthMm: { type: "number" }, color: hexProp, rotation: { type: "number" }, dx: { type: "number" }, dz: { type: "number" } } },
    },
    drop: {
      type: "object",
      description: "earring styles chandelier and pendant, necklace style drop-pendant: the piece built from parts hanging one below the other, top first. parts replaces the whole list.",
      properties: {
        top: { type: "string", enum: ["post", "hook"] },
        parts: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: [...DROP_KINDS], description: "stone: a stone with optional halo and petals/leaves (flowers, clusters, sprays); strands: a bar with strands of stones (chandelier strands, briolette fringes, tiers); frame: open gold outline in the stone's shape and size; bow: pavé ribbon bow" },
              stone: { type: "object", properties: { gem: gemProp, cut: { type: "string", enum: [...CUTS] }, shape: { type: "string", enum: [...SHAPES] }, lengthMm: { type: "number" }, widthMm: { type: "number" }, color: hexProp, rotation: { type: "number", description: "pears and hearts: 0 points down, 180 points up" } } },
              showStone: { type: "boolean" },
              small: { type: "object", properties: { gem: gemProp, cut: { type: "string", enum: [...CUTS] }, color: hexProp, shapes: { type: "array", items: { type: "string", enum: [...SHAPES] }, description: "repeating order: around the petals, or down each strand (e.g. pear, round, pear)" }, widthMm: { type: "number" }, rotation: { type: "number" }, turns: { type: "array", items: { type: "number" }, description: "extra turn per stone in shapes, by position" } } },
              count: { type: "integer", description: "petals/leaves (stone) or strands (strands)" },
              arrange: { type: "string", enum: [...DROP_ARRANGE] },
              halo: { type: "boolean", description: "halo round the stone, or pavé on a frame or bow" },
              haloShape: { type: "string", enum: [...SHAPES] }, haloMm: { type: "number" },
              perStrand: { type: "integer" }, taper: { type: "string", enum: ["even", "v", "u"] }, openMiddle: { type: "boolean" }, barStones: { type: "boolean" },
              spreadMm: { type: "number", description: "strands: bar width; bow: bow width; frame: gap round the stone" }, curveMm: { type: "number" },
              gapMm: { type: "number" }, link: { type: "string", enum: ["ring", "chain", "direct"] },
              anchor: { type: "string", enum: ["below", "beside"], description: "hang below a part (default) or sit beside it" },
              from: { type: "integer", description: "0-based index of the part it hangs from / sits beside; -1 = the previous part" },
              side: { type: "string", enum: ["left", "right"] },
              offsetX: { type: "number", description: "mm, + to the right" }, offsetZ: { type: "number", description: "mm, + downward" },
              tilt: { type: "number", description: "degrees the whole part is tilted" },
              pair: { type: "boolean", description: "add a mirrored twin on the other side (two side drops, two wings)" },
            },
          },
        },
      },
    },
    accents: { type: "object", properties: { enabled: { type: "boolean", description: "accent stones on or off (styles with a main stone)" }, gem: gemProp, color: hexProp, glow: glowProp, cut: { type: "string", enum: ["faceted", "polki", "rose-cut"] }, sizeCt: { type: "number", description: "each, 0.005–6" }, shapes: { type: "array", items: { type: "string", enum: [...SHAPES] }, description: "tennis styles: 1–12 shapes repeated in order, e.g. [\"round\",\"round\",\"round\",\"marquise\"]" }, orientation: { type: "string", enum: ["along", "across", "alternate"] }, turns: { type: "array", items: { type: "number" }, description: "extra turn in degrees for each stone in shapes, by position, so some stones point one way and others another (e.g. shapes [round, round, marquise] with turns [0, 0, 90])" }, twins: { type: "array", items: { type: "boolean" }, description: "by position: true sets two stones side by side there (twin baguettes between rounds)" }, colors: { type: "array", items: hexProp, description: "a colour for each stone in turn, repeating; use for rainbow, ombré or two-tone lines (e.g. 12–20 colours for a rainbow that runs there and back)" }, sizes: { type: "array", items: { type: "number" }, description: "by position: size multiple of each stone, e.g. [2, 1, 1.2, 1] for big round, small round, baguette, small round" } } },
    frames: {
      type: "array",
      description: "ring/earring style deco: layers round the centre stone, inside out. Replaces the whole list.",
      items: { type: "object", properties: {
        kind: { type: "string", enum: ["stones", "milgrain", "metal", "fill"], description: "fill = a mosaic packed solid with stones from the layer inside out to this outline (e.g. a square cushion of cabochons round a long marquise)" }, outline: { type: "string", enum: [...SHAPES], description: "the layer's shape: round, octagon, hexagon, cushion…" },
        ratio: { type: "number", description: "the outline's length to width (1 = square or round); leave out to follow the centre stone's proportions" },
        gem: gemProp, color: hexProp, cut: { type: "string", enum: [...CUTS] }, shape: { type: "string", enum: [...SHAPES], description: "stone shape: round pavé, princess/baguette calibré, pear/oval petals" },
        widthMm: { type: "number" }, direction: { type: "string", enum: ["along", "radial"], description: "radial = fanning out from the centre (calibré, ballerina, petals)" },
        alt: { type: "object", properties: { gem: gemProp, color: hexProp, shape: { type: "string", enum: [...SHAPES] }, cut: { type: "string", enum: [...CUTS] } }, required: ["gem", "color", "shape"], description: "stripes of a second gem" },
        every: { type: "integer", description: "stones of the first gem between each second-gem stone" }, gapMm: { type: "number" },
      } },
    },
    fringe: { type: "object", properties: { enabled: { type: "boolean" }, gem: gemProp, color: hexProp, sizeMm: { type: "number", description: "1.5–14" } } },
    enamel: { type: "object", properties: { enabled: { type: "boolean" }, color: hexProp } },
    metal: { type: "string", enum: [...METALS] },
    purity: { type: "object", properties: { karat: { type: "number", enum: [14, 18, 22, 24] } } },
    setting: { type: "object", properties: { style: { type: "string", enum: [...SETTINGS] }, height: { type: "number", description: "rings only: 0 low … 1 tall" } } },
    sides: { type: "object", properties: { kind: { type: "string", enum: [...SIDE_KINDS] }, sizeCt: { type: "number" }, hug: { type: "boolean", description: "sized to the centre and set tight against it (classic half-moon trilogy)" }, hugFrac: { type: "number", description: "0.4–1, how much of the centre's length the sides cover" }, follow: { type: "string", enum: ["level", "band"], description: "band = side stones curve down with the band, set flush into it" } } },
    gallery: { type: "object", properties: { roseCut: { type: "boolean", description: "stones under the centre stone on or off" }, under: { type: "string", enum: ["peekaboo", "hidden-halo"], description: "two peek-a-boo stones, or a row round the gallery" } } },
    band: { type: "object", properties: { widthMm: { type: "number" }, finish: { type: "string", enum: [...BAND_FINISHES] }, profile: { type: "string", enum: ["raised", "low", "set-in", "flush"], description: "the design up on top of the band, low on it, or set into a band that widens to hold it (Deco plaques, cigar bands, flush settings)" }, shape: { type: "string", enum: ["classic", "flat", "cigar"] }, pave: { type: "string", enum: ["none", "shoulders", "half", "full"], description: "stones running down the band" }, paveRows: { type: "integer" }, paveGem: gemProp, paveShape: { type: "string", enum: [...SHAPES] }, paveMm: { type: "number" }, paveAngle: { type: "number", description: "0 = straight line; 30–50 = a vine of marquise/pear leaves angled alternately" } } },
    options: {
      type: "object",
      properties: {
        halo: { type: "boolean" }, accentTop: { type: "boolean" }, pave: { type: "boolean" },
        hoopDiameterMm: { type: "number" }, hoopShape: { type: "string", enum: ["round", "oval", "paperclip"] }, linkStyle: { type: "string", enum: ["x", "chevron"], description: "gold collar links" }, lengthIn: { type: "number", description: "necklace length in inches, 12–40" },
        chain: { type: "string", enum: [...CHAIN_STYLES] }, count: { type: "integer", description: "stones, stations, tiers, strands or bells depending on style" },
        layers: { type: "integer", description: "rows or strands, 1–7" }, bangleSize: { type: "string", enum: [...BANGLE_SIZES] },
        decoWrap: { type: "boolean", description: "deco style: the top's stones carry on over its rounded sides, down towards the band (cushion cocktail rings covered all over)" },
        decoDome: { type: "number", description: "deco style: 0 a flat Art Deco plaque, 0.5–1 a domed (bombé) cocktail ring whose layers curve down and out" },
      },
    },
  },
};

export const proposeDesignTool: Anthropic.Tool = {
  name: "propose_design",
  description:
    "Propose a concrete change to the ring the person is designing. The app shows it as a suggestion they can apply with one click. Use it whenever you recommend a specific change; propose one coherent change at a time.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "3–6 words naming the change, e.g. 'Step-cut half-moons, lower setting'." },
      why: { type: "string", description: "One or two sentences tying the change to their style or the stone." },
      patch: designPatchSchema,
    },
    required: ["title", "why", "patch"],
  },
};

export const CHAT_SYSTEM = `You are a senior fine-jewellery design consultant inside a 3D jewellery design app used by working jewellers, many in the Indian trade.
You know Western fine jewellery and Indian traditions equally well: kundan and polki, jadau, meenakari, temple work, navratna, bridal pieces,
22k gold, and how jhumkas, chandbalis, rani haars, chokers, kadas and maang tikkas are built and worn. Lean maximalist when the person's taste does.
Talk to them as a fellow professional: construction, stone layouts, proportions, weight and wearability, what to tell the karigar.
You can see the piece being designed (as JSON) and, when provided, the person's STYLE PROFILE: their preferences (style, metals, gems,
shapes, scale, occasions, budget, sizes), inspiration photos, style icons, notes, what their own saved designs show, and suggestions they applied before.
Ground every suggestion in that profile and in the centre stone's character: use their metals, karat, favourite gems and shapes, scale and sizes unless
they ask otherwise, and say briefly how a suggestion fits their taste. Never suggest anything listed under AVOID. Where the profile and the current piece
disagree, follow what they are doing now and mention the difference once. When the person names a style icon, draw on that person's
well-known, publicly documented jewellery taste in general terms (e.g. "quiet, heirloom-feeling pieces"); don't invent specific items they own.
Be specific and practical: proportions, cut pairings, setting height, wearability, what to ask the jeweller.
Keep replies short (under 150 words) and conversational. When you recommend a concrete change, call propose_design so they can apply it.
When they want a shape the styles don't cover (a peacock, a monogram, a lotus, an Art Deco fan), call create_motif to draw it.
The app can only change the fields in propose_design and create_motif; for anything else (filigree, nakashi, engraving, jadau detailing, sahara ear chains), describe it in words.
Never claim a stone's origin or treatment without a lab report.

COLOUR GRADES. The same gem looks different by deposit. When someone asks for, say, a Colombian emerald or a Burmese ruby, set the stone's color, clarity and glow from this table (these describe a look; never claim where a real stone came from):
${GRADE_GUIDE}`;

