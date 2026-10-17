import Anthropic from "@anthropic-ai/sdk";
import { ALL_STYLES, TYPES } from "../design";
import { STYLE_GUIDE, designPatchSchema } from "./chat";

/** Recreating a finished piece from a photo. */

export const recreateDesignTool: Anthropic.Tool = {
  name: "recreate_design",
  description: "Record the closest editable version of the photographed piece that this app can build.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "A short name for the piece, e.g. 'Fleur chandelier with canary cushion'." },
      type: { type: "string", enum: [...TYPES] },
      style: { type: "string", enum: ALL_STYLES, description: "Must belong to the type." },
      patch: designPatchSchema,
      description: { type: "string", description: "Two or three sentences describing the piece as a jeweller would: construction, stones, metal." },
      not_modelled: { type: "array", items: { type: "string" }, description: "Details in the photo the app can't build (filigree, engraving, enamel patterns, exact motif shapes), so the person can tell the karigar." },
    },
    required: ["title", "type", "style", "patch", "description", "not_modelled"],
  },
};

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
  * Layouts don't have to be one straight line: anchor "beside" puts a part next to another (toi-et-moi, clusters side by side), from picks which part to hang from, offsetX/offsetZ shift it, tilt angles it, pair adds a mirrored twin (two side drops). Asymmetric pieces are fine.
- Single studs: earrings "stud" (extraStones for multi-stone studs). Hoops: hoop or huggie with options.hoopShape and pave.
- Rings, necklaces, bracelets and Indian pieces: the matching type and style, centre stone, accents and options.
- Cocktail rings with layers or a mosaic of stones round a centre stone: ring "deco" with frames, inside out.
  * Keep it to real sizes: the whole top of a ring is usually 15–28 mm across, so with a 10–14 mm centre stone there is room for only
    2–4 layers of small stones (1.5–3 mm each, widthMm), packed tight (gapMm 0–0.2). Don't add more layers than you can see.
  * A mosaic of mixed stones (e.g. pink cabochons with green marquise leaves): a layer of the main stones with the second gem as alt
    every few stones, rather than separate rings of each.
  * A top that rises to the centre stone (bombé, dome-shaped) needs options.decoDome 0.5–1; a flat Art Deco plaque 0.
  * When the stones carry on down the shank, set band.pave ("shoulders", "half" or "full") with paveRows, paveGem, paveColor and
    paveShape matching the stones on the top (a vine of angled marquise leaves for leaf patterns), and a wider band (widthMm 4–8).
Estimate sizes in millimetres from typical proportions (an earring is usually 15–70 mm long; a stud 5–15 mm) or any scale reference.
If the stones in a line change colour (rainbow, ombré, alternating gems), list them in accents.colors in order, one hex per stone, repeating; don't flatten them to one colour.
Set metal from the colour of the gold. Never state a stone's origin or treatment. Always call recreate_design exactly once.`;
