import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { STYLES, designForAi, normalizeDesign, showcaseDesign, type Design } from "../design";
import { callTool } from "./client";
import { ALL_STYLES, FRAME_PRESETS, SHOWCASE, TYPES } from "../design";
import { STYLE_GUIDE, designPatchSchema } from "./chat";

export const recreateDesignTool: Anthropic.Tool = {
  name: "recreate_design",
  description: "Record the closest editable version of the photographed piece that this app can build.",
  input_schema: {
    type: "object",
    properties: {
      analysis: { type: "string", description: "Write this first, before choosing anything: a careful read of the photo in 5–8 short lines. Outline of the top seen from above (e.g. pointed lozenge, oval, cushion with rounded sides) and its size; profile (flat, gently or highly domed); the centre stone, which way it lies and its setting; how the stones are organised (bands following the centre? how many? packed mosaic? leaves in cells?) and which stones in which colours; how much metal shows; what the sides and the band do." },
      inventory: {
        type: "array",
        description: "Write this before choosing anything else: every group of stones you can actually see in the photos, one entry per group (the main stone, each ring of accents, a cluster, a fringe, leaves, beads...). Count what is there; do not guess or round up. If you can't see part of the piece, say so in 'where' rather than inventing it.",
        items: { type: "object", properties: {
          what: { type: "string", description: "e.g. 'main pear diamond', 'briolette drops', 'small round diamonds'" },
          count: { type: "integer", description: "how many you can count in ONE piece (one earring of a pair)" },
          shape: { type: "string" }, cut: { type: "string" },
          size: { type: "string", description: "size compared with the main stone, e.g. 'about 1/4 of the pear's length', or mm if known; say if they vary (e.g. '3 large and 4 small')" },
          where: { type: "string", description: "exactly where they sit, e.g. 'tight cluster under the pear's rounded end only, from about 4 to 8 o'clock; nothing along the sides or the tip'" },
        }, required: ["what", "count", "shape", "size", "where"] },
      },
      stone_direction: { type: "string", enum: ["along the finger", "across the finger", "diagonal", "not a ring or round stone"], description: "Rings: answer only after finding the band in the photo (the gold hoop the finger goes through; on a ring held in the fingers, it runs down to where the fingers grip, and the top slopes away towards it). Which way does the centre stone's LONG axis run compared with the finger? Along the finger = the long axis runs the same way as the finger, its points aiming towards the hand and the fingertip, at right angles to the band where the band meets the top. Across the finger = the long axis runs from one side of the band to the other, parallel to the band. Almost every ring is set along or across; a photo taken at an angle, or a stone tilted in the hand, makes it look diagonal. If the long axis is nearer the finger than the band, answer along; nearer the band, across. Answer diagonal only when the setting itself is deliberately turned 45° (rare). Ignore how the photo is tilted." },
      colour_samples: {
        type: "array",
        description: "For each coloured gem in the piece (the centre stone, each layer's stones and its alt stones, accents, band stones, drop stones), one point in a photo at the middle of the body of a typical stone of that colour, so the app can read its true colour from the pixels. Pick a spot that shows the stone's own colour: not a sparkle, reflection, shadow, edge or metal. x and y run 0–1 from the photo's top-left.",
        items: { type: "object", properties: {
          target: { type: "string", description: "center | accents | band | fringe | frame:<index> | frame:<index>:alt | part:<index> (0-based index into frames or drop.parts, as in your design)" },
          photo: { type: "integer", description: "0-based photo index" }, x: { type: "number" }, y: { type: "number" },
        }, required: ["target", "photo", "x", "y"] },
      },
      start_from: { type: "string", enum: ["none", ...SHOWCASE.map((x) => x.name)], description: "The showcase piece this is closest to, if one is really close in construction; then patch holds only what differs from it. 'none' to build from scratch." },
      title: { type: "string", description: "A short name for the piece, e.g. 'Fleur chandelier with canary cushion'." },
      type: { type: "string", enum: [...TYPES] },
      style: { type: "string", enum: ALL_STYLES, description: "Must belong to the type." },
      patch: designPatchSchema,
      description: { type: "string", description: "Two or three sentences describing the piece as a jeweller would: construction, stones, metal." },
      not_modelled: { type: "array", items: { type: "string" }, description: "Details in the photo the app can't build (filigree, engraving, enamel patterns, exact motif shapes), so the person can tell the karigar." },
    },
    required: ["inventory", "analysis", "stone_direction", "start_from", "title", "type", "style", "patch", "description", "not_modelled"],
  },
};

export const refineDesignTool: Anthropic.Tool = {
  name: "check_and_correct",
  description: "Score how closely the 3D build matches the photo, list what differs, and record the corrected design.",
  input_schema: {
    type: "object",
    properties: {
      score: { type: "number", description: "0–10: how closely the 3D build (last image) matches the real piece now, before your corrections. 10 = indistinguishable in outline, profile, stone layout, colours and metal." },
      differences: { type: "array", items: { type: "string" }, description: "The most important ways the build still differs from the photo, worst first, each a short phrase." },
      ...(recreateDesignTool.input_schema.properties as Record<string, unknown>),
    },
    required: ["score", "differences", "inventory", "analysis", "stone_direction", "start_from", "title", "type", "style", "patch", "description", "not_modelled"],
  },
};

const FRAME_TEMPLATES = FRAME_PRESETS.map((p) => `    - ${p.name}: ${p.blurb} frames=${JSON.stringify(p.frames)}`).join("\n");
const mosaic = SHOWCASE.find((x) => x.name === "Marquise mosaic cocktail ring");
const MOSAIC_EXAMPLE = mosaic ? JSON.stringify({ type: mosaic.type, style: mosaic.style, patch: mosaic.patch }) : "";

export const RECREATE_SYSTEM = `You are a master jeweller looking at a photo of a finished piece of jewellery (or a sketch, or a reference picture).
Rebuild it as faithfully as you can in a 3D design app, using only the fields of recreate_design, so the person can then customise it.
Styles available, by type:
${STYLE_GUIDE}

How to choose:
- Earrings that hang (drops, chandeliers, clusters with drops, stacked stones, open frames, bows, fringes): use earrings + "chandelier" or "pendant" and describe the piece in drop.parts, top first. The same builder works for a necklace pendant ("drop-pendant").
  * A stone with petals or leaves around it (a flower, a marquise fleur, a spray): kind "stone" with small.shapes, count and arrange (around, above, below, sides). Pears point down at rotation 0 and up at 180; for petals 0 points outward.
  * A halo: halo true with haloShape and haloMm. Coloured diamonds: gem diamond with the body colour in color.
  * Strands, tiers or a fringe: kind "strands" with count, perStrand, small.shapes in order down each strand, spreadMm, curveMm, taper; barStones for a tier of stones on the bar; openMiddle when a big drop hangs in the centre (then add that drop as the next part).
  * Open outlines: kind "frame" with the frame's shape and size in stone and showStone false; halo true for pavé.
  * Bows: kind "bow".
  * Use link "direct" for rigid joints and "ring" for parts that swing.
  * Two rows of small stones round ONE stone (e.g. small round diamonds right at the edge, then briolettes hanging
    beyond them): the first part has the stone and one row; add a second part with showStone false, anchor "on",
    from = the first part, and its own small stones and arc. Never use "beside" for this.
  * A stone that sits tilted (a pear leaning out to one side) is a rotation, not something to leave out. Rotation sets
    where the tip of a pear, marquise or heart points on the earring drawn on the LEFT of the view (the right one is its
    mirror): 0 = tip down, 180 = tip up, 90 = tip to the right (towards the other earring), -90 = tip to the left (away).
    Up and outward = -120 to -150; up and inward = 120 to 150. Read it off the LEFT piece in the photo. Values stay
    between -180 and 180. Use the same rotation on every part that sits on that stone.
  * Briolettes round a stone always hang from their narrow drilled end; leave small.rotation at 0 for them. Give count
    the full number in the cascade (both tiers; packed ones drop into a second tier by themselves) and small.sizes one
    size per stone in order round the arc, so the biggest hang where the photo shows them.
  * A row of small stones between a stone and the drops hanging from it: put the drops on the stone's part, and the row as
    a second part with anchor "on", from = that part, showStone false, the same stone, and its own arc. The drops then hang
    outside the row.
  * Layouts don't have to be one straight line: anchor "beside" puts a part next to another (toi-et-moi, clusters side by side), from picks which part to hang from, offsetX/offsetZ shift it, tilt angles it, pair adds a mirrored twin (two side drops). Asymmetric pieces are fine.
- Single studs: earrings "stud" (extraStones for multi-stone studs). Hoops: hoop or huggie with options.hoopShape and pave.
- Rings, necklaces, bracelets and Indian pieces: the matching type and style, centre stone, accents and options.
- Lines of stones (tennis bracelets, line necklaces, rivieras): read the repeat in order (e.g. asscher, then a cluster of rounds) into
  accents.shapes with sizes, turns and twins (twins = two stones side by side at that spot).
  * A vine or garland of leaves (pear and marquise stones angled out to each side, often round stones down the middle): accents.layout
    "garland", shapes like [pear, marquise, round] (rounds become the stem).
  * A line that snakes gently side to side (a serpentine marquise bracelet): accents.layout "wave".
  * Several rows side by side: options.layers. A tassel hanging from a bracelet: tennis with fringe enabled (gem diamond for diamond strands).
  * Stones that fade from one colour to another (ombré): accents.ombre with 2–6 colours, front first. Down a ring's band:
    band.paveOmbre, from the top down.
- Panels of repeated open motifs (a "carpet" bracelet: marquise or round centres in pavé frames edged with seed pearls, joined
  by little diamonds): bracelet "openwork", with the motif's centre stone in center and its bands in frames (gem pearl, cut bead
  for a pearl edge; fit "point" keeps a pointed lozenge); options.layers = rows of motifs.
- A short bar of stones set into a chain (a centre stone with graduated stones on each side, usually bezel-set and linked
  end to end): necklace or bracelet "bar". The middle stone goes in center (its own shape, e.g. cushion or princess), the
  side stones in accents (shapes, gem, cut; sizeCt = the largest side stone, next to the centre), options.count = all the
  side stones on both sides together (8 for four each side). accents.sizes lists each side stone's size relative to the
  largest, from the centre outwards (e.g. [1, 0.9, 0.8, 0.7]); leave it empty for an even taper.
- A necklace with a line of stones across the front and drops hanging from it (pear fringes, baguette lines with pears): necklace
  "collar", the line in accents (e.g. shapes [baguette], orientation across), the drop in center, options.count drops.
- Stones linked along a chain with no rim round them, each joined by a little ring through a hole near its edge (drilled
  rose cuts, "diamonds by the yard"): necklace "by-the-yard" with options.stoneLink "drilled".
- Split shanks (the band divides into two arms that open around the head): band.split, the gap in mm at the top (2–5).
  Stones on the gallery under the centre stone: gallery.under "hidden-halo", with gallery.color for coloured stones.
- Cocktail rings with layers or a mosaic of stones round a centre stone: ring "deco" with frames, inside out.
  * Keep it to real sizes: the whole top of a ring is usually 15–28 mm across, so with a 10–14 mm centre stone there is room for only
    2–4 layers of small stones (1.5–3 mm each, widthMm), packed tight (gapMm 0–0.2). Don't add more layers than you can see.
  * A mosaic of mixed stones packed solid (e.g. pink cabochons with green marquise leaves): one frame of kind "fill" with the main
    stone and the second gem as alt every few stones. It packs everything from the layers inside it out to its outline, so a
    square or cushion top round a long marquise has no bare metal. Set the outline's ratio (1 = square) when the top's shape
    doesn't follow the centre stone's proportions.
  * When the stones carry on over the rounded sides of the top, set options.decoWrap true.
  * Bands that sit tight against each other all the way round (echoing a marquise or pear, no metal showing between them):
    give every layer the centre stone's outline and fit "point" when the outer edge stays pointed at the stone's tips (a kite
    or lozenge round a marquise or pear), or fit "hug" when it rounds off into an oval.
  * Look hard at how the stones are organised before choosing. Bands that follow the centre stone's outline (concentric rings
    of stones, often separated by milgrain, growing rounder towards the edge) are several "stones" layers whose outline is the
    centre's shape with a ratio that gets smaller outward (e.g. marquise, then marquise ratio 1.75, then 1.45). Use "fill" only
    when the stones are packed with no banding.
  * Judge the profile: if the top rises to the centre stone and curves down on every side, it is domed (decoDome 0.8–1).
  * Seen along the finger, does the top run straight across, or do its sides bend down over the finger into the band (the
    top hugging the finger like a saddle, sloping away to where the fingers grip)? Bending sides: options.decoBend 0.5–0.9.
  * Measure the top's outline: its length along the finger against its width across. When bands hug a long centre stone
    but the whole top is nearly as wide as it is long, set options.decoSpread (0.4–0.8) instead of switching to a square.
  * Always set the top's real size: options.decoLengthMm (along the finger) and options.decoWidthMm (across), judged
    against the centre stone (e.g. a top about 1.7 times the length of a 15 mm marquise is about 26 mm long). The app
    fits the top to these, so the layers can't grow it to an unreal size.
  * A square or cushion top only when the photo's top really has straight sides and corners. When the stones curve round the
    centre stone in bands that echo its shape (most cocktail rings round a marquise, pear or oval), use fit "hug" bands with the
    centre's own outline, as in the worked example; never turn such a piece into a square.
  * ORIENTATION (rings): judge every direction relative to the band, never from how the photo is tilted. First find where
    the top curves down into the band: on a ring held between fingers, the fingers usually grip it there, and the top slopes
    away towards them. That line is across the finger. A stone whose long axis is at right angles to that line points along
    the finger: center.rotation 0. A stone whose long axis runs along that line lies across the finger: rotation 90. Only use
    45 when the stone really sits diagonally to the band. A photo taken at an angle makes a straight stone look diagonal.
  * In the analysis, say where the band meets the top and which way the centre stone points relative to it.
  * Leaves winding through a mosaic in diagonal lines: pattern "vines"; hand-set stones of slightly different sizes: vary 0.15–0.25.
  * A centre stone in a fine gold rim with beaded (milgrain) edge: setting.style "bezel".
  * A top that rises to the centre stone (bombé, dome-shaped) needs options.decoDome 0.5–1; a flat Art Deco plaque 0.
  * Start from the closest of these layer templates and adapt it (stone sizes, colours, outlines, how many layers):
${FRAME_TEMPLATES}
  * Showcase pieces you can start from (start_from) when one is genuinely close in construction:
${SHOWCASE.filter((x) => x.type === "ring" || x.type === "earrings" || x.type === "necklace" || x.type === "bracelet").map((x) => `    - ${x.name} (${x.type}, ${x.style})`).join("\n")}
  * A worked example, a domed marquise cocktail ring in hugging bands of pink sapphire cabochons and emerald leaves, its stones
    carried on down the sides and the band. For a piece like this, copy it closely and change only what the photo shows differently: ${MOSAIC_EXAMPLE}
  * When the stones carry on down the shank, set band.pave ("shoulders", "half" or "full") with paveRows, paveGem, paveColor and
    paveShape matching the stones on the top (a vine of angled marquise leaves for leaf patterns), and a wider band (widthMm 4–8).
Old and antique diamonds (old-mine, old European, antique marquise, "moval" = a marquise with softly rounded sides) are
faceted: cut "faceted" with the nearest shape (marquise for a moval or antique marquise, old-mine for an old cushion, round
for an old European). Use "rose-cut" only for a flat-backed rose cut. A diamond is white (#f4f6fb, clarity 0.95) unless the
photo or notes say it is coloured.
Facts in the notes are exact, not hints: ring size (ringSize, US), karat (purity.karat), carat weight (center.carat, and size
the stone from it), the whole top's measurements (options.decoLengthMm and decoWidthMm), and metal.
BUILD ONLY WHAT YOU INVENTORIED. Every stone in the design must come from the inventory, with the same count, the same
shape, the same relative size and in the same place. Never add stones, rings of stones or fans that aren't there, and never
spread a cluster that sits under one end of a stone all the way round it (use the drop part's arc for a cluster on part of the
outline, and small.sizes when the stones in it differ in size). If the app can't place something exactly, build the nearest
honest version and list the difference in not_modelled; don't fill the gap with invented detail.
The main stone is never dropped: when the piece has a centre or main stone that differs from the rest (bigger, another shape
or colour), it goes in center and the style must be one that shows center. Never fold it into a run of accents or a riviera
of identical stones; check the finished design has it, at its size and shape, in the middle.
How each stone is held matters: separate metal prongs round a stone (even a cabochon) are a claw setting (four-claw for single
prongs, double-claw only when the prongs come in pairs, six-claw for six); a continuous metal rim is a bezel. For drop parts set
part.setting; otherwise setting.style. Cabochons are domed, never flat.
Carat weights in the notes set the size: a round diamond is about 6.5 mm at 1 ct, 8.1 mm at 2 ct, 9.3 mm at 3 ct, 10.2 mm at 4 ct
and 11 mm at 5 ct across; other shapes and gems scale the same way by weight.
Match the photo's light with options.lighting: daylight for outdoors or by a window, warm for indoor lamp light, studio for
a white product shot.
Estimate sizes in millimetres from typical proportions (an earring is usually 15–70 mm long; a stud 5–15 mm) or any scale reference.
If the stones in a line change colour (rainbow, ombré, alternating gems), list them in accents.colors in order, one hex per stone, repeating; don't flatten them to one colour.
The person's notes override what you think you see: if the notes give a size, direction, shape or stone, use it. Set metal from the colour of the gold. Never state a stone's origin or treatment. Always call recreate_design exactly once.`;

export const REFINE_SYSTEM = () => `${RECREATE_SYSTEM}

YOU ARE NOW CHECKING YOUR OWN WORK. The first images are the real piece; the last image is the 3D build made from your
previous answer (its design is given below). Compare them closely and correct the build so it looks as much like the
real piece as this app allows:
- overall outline and proportions of the piece, and its size;
- the centre stone: shape, size, colour, cut, how it is set;
- every layer or row of stones: shape, size, colour, how many, which way they point, how tightly they are packed, and
  whether gold shows between them;
- the metal colour, a flat or domed top, and whether the pattern continues down the band;
- the centre stone's direction RELATIVE TO THE BAND (along or across the finger), not relative to the picture frame: the
  build is shown from a different angle than the photo, so compare where each stone points against where its band is;
- anything missing or extra.
First score the build and list the differences. Then correct ONLY those differences: keep the style, outline, layers and
everything else that already matches exactly as they are (change a value only when it is clearly wrong). Return the whole
design with start_from "none" (not just the changes). If it already matches closely, return it unchanged. List anything the
app can't build in not_modelled.`;

const Result = z.object({
  inventory: z.array(z.object({ what: z.string(), count: z.number().catch(0), size: z.string().catch(""), where: z.string().catch("") }).passthrough()).max(30).catch([]).default([]),
  colour_samples: z.array(z.object({ target: z.string(), photo: z.number().int().min(0), x: z.number().min(0).max(1), y: z.number().min(0).max(1) })).max(24).catch([]).default([]),
  analysis: z.string().default(""), stone_direction: z.string().default(""), start_from: z.string().default("none"), score: z.number().nullish(), differences: z.array(z.string()).default([]),
  title: z.string(), type: z.enum(TYPES), style: z.string(), patch: z.record(z.unknown()),
  description: z.string(), not_modelled: z.array(z.string()).default([]),
});
export type Recreation = {
  title: string; type: (typeof TYPES)[number]; style: string; patch: Record<string, unknown>; description: string; notModelled: string[];
  analysis: string; base: Design | null; score: number | null; differences: string[];
  samples: { target: string; photo: number; x: number; y: number }[];
  inventory: { what: string; count: number; size: string; where: string }[];
};

export function directionFromNotes(notes?: string): number | null {
  const n = (notes ?? "").toLowerCase();
  if (/along the (finger|hand)|north[- ]south|lengthwise|points? (up|down) the finger|towards? the (fingertip|knuckle|nail|hand)/.test(n)) return 0;
  if (/across the (finger|hand)|east[- ]west|side to side|parallel (to|with) the band|sideways/.test(n)) return 90;
  if (/\b(stone|diamond|centre|center)\b[^.;,]{0,20}\b(is |sits |set |turned |lies |points )?diagonal(ly)?\b|points diagonal to the band|\b45 ?(°|deg)/.test(n)) return 45;
  return null;
}

const TIPPED = new Set(["pear", "marquise", "heart", "kite", "trillion"]);
// "the tip points to about 10 o'clock" (left piece) -> drop-stone rotation: 0 tip down, 180 up, 90 right, -90 left.
export function tipFromNotes(notes?: string): number | null {
  const m = (notes ?? "").toLowerCase().match(/tip points? (?:to |towards? )?(?:about |roughly )?(\d{1,2})(?::(\d{2}))? o'?clock/);
  if (!m) return null;
  const hour = Number(m[1]) % 12 + (m[2] ? Number(m[2]) / 60 : 0);
  if (!(hour >= 0 && hour < 12)) return null;
  const r = 180 - hour * 30;
  return Math.round(r > 180 ? r - 360 : r <= -180 ? r + 360 : r);
}

// Hard facts the person wrote down win over anything the model guessed from the photo.
export function factsFromNotes(notes: string | undefined, type: string): { ringSize?: number; carat?: number; karat?: 14 | 18 | 22 | 24 } {
  const n = (notes ?? "").toLowerCase().replace(/,/g, " ");
  const out: { ringSize?: number; carat?: number; karat?: 14 | 18 | 22 | 24 } = {};
  if (type === "ring") {
    const m = n.match(/(?<!indian |uk |eu )\b(?:ring )?size\s*(?:us\s*)?(\d{1,2}\s+\d\/\d|\d{1,2}(?:\.\d{1,2})?)(?![\d.]|\s*(?:mm|cm))/);
    if (m) {
      const [whole, frac] = m[1].split(/\s+/);
      const v = frac ? Number(whole) + Number(frac.split("/")[0]) / Number(frac.split("/")[1]) : Number(whole);
      if (v >= 3 && v <= 13) out.ringSize = Math.round(v * 4) / 4;
    }
  }
  for (const m of n.matchAll(/(?<!total |tw |weight of )\b(\d{1,2}(?:\.\d{1,2})?)\s*(?:ct|cts|carats?)\b(?!\s*(?:tw|t\.w|total|gold|yellow|white|rose))/g)) {
    const v = Number(m[1]);
    if (v > 0.05 && v <= 60 && !/\b(total|tw|ctw)\b/.test(n.slice(Math.max(0, m.index! - 25), m.index! + m[0].length + 12))) { out.carat = v; break; }
  }
  const k = n.match(/\b(14|18|22|24)\s*(?:k|kt|karat|carat gold|ct gold)\b/);
  if (k) out.karat = Number(k[1]) as 14 | 18 | 22 | 24;
  return out;
}

const ROTATION: Record<string, number> = { "along the finger": 0, "across the finger": 90, diagonal: 45 };

function tidy(input: unknown, notes?: string): Recreation | null {
  const r = Result.safeParse(input);
  if (!r.success) return null;
  const d = r.data;
  const turn = directionFromNotes(notes) ?? ROTATION[d.stone_direction] ?? null;
  if (d.type === "ring" && turn !== null) {
    const c = (d.patch.center && typeof d.patch.center === "object" ? d.patch.center : {}) as Record<string, unknown>;
    d.patch = { ...d.patch, center: { ...c, rotation: turn } };
  }
  const tip = tipFromNotes(notes);
  if (d.type === "earrings" && tip !== null) {
    const drop = (d.patch.drop && typeof d.patch.drop === "object" ? d.patch.drop : null) as { parts?: Record<string, unknown>[] } | null;
    const first = drop?.parts?.[0]?.stone as Record<string, unknown> | undefined;
    if (drop?.parts && first && TIPPED.has(String(first.shape))) {
      const same = (st: unknown) => !!st && typeof st === "object" && (st as Record<string, unknown>).shape === first.shape && (st as Record<string, unknown>).lengthMm === first.lengthMm;
      d.patch = { ...d.patch, drop: { ...drop, parts: drop.parts.map((p, i) => (i === 0 || (same(p.stone) && p.anchor === "on") ? { ...p, stone: { ...(p.stone as object), rotation: tip } } : p)) } };
    }
  }
  const facts = factsFromNotes(notes, d.type);
  if (facts.ringSize) d.patch = { ...d.patch, ringSize: facts.ringSize };
  if (facts.karat) d.patch = { ...d.patch, purity: { karat: facts.karat } };
  if (facts.carat) {
    const c = (d.patch.center && typeof d.patch.center === "object" ? d.patch.center : {}) as Record<string, unknown>;
    d.patch = { ...d.patch, center: { ...c, carat: facts.carat } };
  }
  const style = Object.hasOwn(STYLES[d.type], d.style) ? d.style : Object.keys(STYLES[d.type])[0];
  const start = SHOWCASE.find((x) => x.name === d.start_from);
  return {
    title: d.title.slice(0, 80), type: d.type, style, patch: d.patch, description: d.description, notModelled: d.not_modelled.slice(0, 8),
    analysis: d.analysis.slice(0, 1500), base: start ? showcaseDesign(start) : null,
    score: typeof d.score === "number" ? Math.max(0, Math.min(10, d.score)) : null, differences: d.differences.slice(0, 8),
    samples: d.colour_samples,
    inventory: d.inventory.map((x) => ({ what: x.what, count: x.count, size: x.size, where: x.where })),
  };
}

type Image = Anthropic.ImageBlockParam;

export async function recreateFromPhotos(photos: Image[], notes?: string, profile?: string): Promise<Recreation | null> {
  const text = [
    photos.length > 1 ? `${photos.length} photos of the same piece.` : "A photo of the piece.",
    notes ? `Notes: ${notes}` : null,
    profile ? `Use this only for what the photo can't show, such as karat, an unclear metal, and sizes:\n${profile}` : null,
  ].filter(Boolean).join("\n");
  return tidy(await callTool({ system: RECREATE_SYSTEM, tool: recreateDesignTool, maxTokens: 16000, effort: "high", content: [...photos, { type: "text", text }] }), notes);
}

export async function refineFromRender(photos: Image[], render: Image, design: unknown, round: number, notes?: string, request?: string): Promise<Recreation | null> {
  const current = normalizeDesign(design);
  const text = [
    `${photos.length > 1 ? `The first ${photos.length} images are photos of the real piece.` : "The first image is a photo of the real piece."} The last image is our 3D build (check ${round}).`,
    notes ? `Notes from the person: ${notes}` : null,
    request ? `The person has looked at the build and asks for this change: "${request}". Make exactly that change; it overrides the photo and anything you think you see. Keep everything else as it is, and still score the build as it was before this change.` : null,
    `The build's design now: ${JSON.stringify({ type: current.type, style: current.style, ...designForAi(current) })}`,
  ].filter(Boolean).join("\n");
  return tidy(await callTool({ system: REFINE_SYSTEM(), tool: refineDesignTool, maxTokens: 16000, effort: "high", content: [...photos, render, { type: "text", text }] }), [notes, request].filter(Boolean).join(" "));
}

export const jpegImage = (dataUrl: string): Image => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.replace(/^data:image\/jpeg;base64,/, "") } });
