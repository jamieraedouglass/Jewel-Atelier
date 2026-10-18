import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { STYLES, designForAi, normalizeDesign } from "../design";
import { callTool } from "./client";
import { ALL_STYLES, FRAME_PRESETS, SHOWCASE, TYPES } from "../design";
import { STYLE_GUIDE, designPatchSchema } from "./chat";

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
  * Layouts don't have to be one straight line: anchor "beside" puts a part next to another (toi-et-moi, clusters side by side), from picks which part to hang from, offsetX/offsetZ shift it, tilt angles it, pair adds a mirrored twin (two side drops). Asymmetric pieces are fine.
- Single studs: earrings "stud" (extraStones for multi-stone studs). Hoops: hoop or huggie with options.hoopShape and pave.
- Rings, necklaces, bracelets and Indian pieces: the matching type and style, centre stone, accents and options.
- Cocktail rings with layers or a mosaic of stones round a centre stone: ring "deco" with frames, inside out.
  * Keep it to real sizes: the whole top of a ring is usually 15–28 mm across, so with a 10–14 mm centre stone there is room for only
    2–4 layers of small stones (1.5–3 mm each, widthMm), packed tight (gapMm 0–0.2). Don't add more layers than you can see.
  * A mosaic of mixed stones packed solid (e.g. pink cabochons with green marquise leaves): one frame of kind "fill" with the main
    stone and the second gem as alt every few stones. It packs everything from the layers inside it out to its outline, so a
    square or cushion top round a long marquise has no bare metal. Set the outline's ratio (1 = square) when the top's shape
    doesn't follow the centre stone's proportions.
  * When the stones carry on over the rounded sides of the top, set options.decoWrap true.
  * Bands that sit tight against each other all the way round (echoing a marquise or pear, no metal showing between them):
    give every layer fit "hug" and the centre stone's outline; each band then follows the one inside it.
  * Look hard at how the stones are organised before choosing. Bands that follow the centre stone's outline (concentric rings
    of stones, often separated by milgrain, growing rounder towards the edge) are several "stones" layers whose outline is the
    centre's shape with a ratio that gets smaller outward (e.g. marquise, then marquise ratio 1.75, then 1.45). Use "fill" only
    when the stones are packed with no banding.
  * Judge the profile: if the top rises to the centre stone and curves down on every side, it is domed (decoDome 0.8–1).
  * A square or cushion top only when the photo's top really has straight sides and corners. When the stones curve round the
    centre stone in bands that echo its shape (most cocktail rings round a marquise, pear or oval), use fit "hug" bands with the
    centre's own outline, as in the worked example; never turn such a piece into a square.
  * Leaves winding through a mosaic in diagonal lines: pattern "vines"; hand-set stones of slightly different sizes: vary 0.15–0.25.
  * A centre stone in a fine gold rim with beaded (milgrain) edge: setting.style "bezel".
  * A top that rises to the centre stone (bombé, dome-shaped) needs options.decoDome 0.5–1; a flat Art Deco plaque 0.
  * Start from the closest of these layer templates and adapt it (stone sizes, colours, outlines, how many layers):
${FRAME_TEMPLATES}
  * A worked example, a domed marquise cocktail ring in hugging bands of pink sapphire cabochons and emerald leaves, its stones
    carried on down the sides and the band. For a piece like this, copy it closely and change only what the photo shows differently: ${MOSAIC_EXAMPLE}
  * When the stones carry on down the shank, set band.pave ("shoulders", "half" or "full") with paveRows, paveGem, paveColor and
    paveShape matching the stones on the top (a vine of angled marquise leaves for leaf patterns), and a wider band (widthMm 4–8).
Estimate sizes in millimetres from typical proportions (an earring is usually 15–70 mm long; a stud 5–15 mm) or any scale reference.
If the stones in a line change colour (rainbow, ombré, alternating gems), list them in accents.colors in order, one hex per stone, repeating; don't flatten them to one colour.
Set metal from the colour of the gold. Never state a stone's origin or treatment. Always call recreate_design exactly once.`;

export const REFINE_SYSTEM = () => `${RECREATE_SYSTEM}

YOU ARE NOW CHECKING YOUR OWN WORK. The first images are the real piece; the last image is the 3D build made from your
previous answer (its design is given below). Compare them closely and correct the build so it looks as much like the
real piece as this app allows:
- overall outline and proportions of the piece, and its size;
- the centre stone: shape, size, colour, cut, how it is set;
- every layer or row of stones: shape, size, colour, how many, which way they point, how tightly they are packed, and
  whether gold shows between them;
- the metal colour, a flat or domed top, and whether the pattern continues down the band;
- anything missing or extra.
Return the whole corrected design with recreate_design (not just the changes). If it already matches closely, return it
unchanged. List anything the app can't build in not_modelled.`;

const Result = z.object({
  title: z.string(), type: z.enum(TYPES), style: z.string(), patch: z.record(z.unknown()),
  description: z.string(), not_modelled: z.array(z.string()).default([]),
});
export type Recreation = { title: string; type: (typeof TYPES)[number]; style: string; patch: Record<string, unknown>; description: string; notModelled: string[] };

function tidy(input: unknown): Recreation | null {
  const r = Result.safeParse(input);
  if (!r.success) return null;
  const d = r.data;
  const style = Object.hasOwn(STYLES[d.type], d.style) ? d.style : Object.keys(STYLES[d.type])[0];
  return { title: d.title.slice(0, 80), type: d.type, style, patch: d.patch, description: d.description, notModelled: d.not_modelled.slice(0, 8) };
}

type Image = Anthropic.ImageBlockParam;

export async function recreateFromPhotos(photos: Image[], notes?: string, profile?: string): Promise<Recreation | null> {
  const text = [
    photos.length > 1 ? `${photos.length} photos of the same piece.` : "A photo of the piece.",
    notes ? `Notes: ${notes}` : null,
    profile ? `Use this only for what the photo can't show, such as karat, an unclear metal, and sizes:\n${profile}` : null,
  ].filter(Boolean).join("\n");
  return tidy(await callTool({ system: RECREATE_SYSTEM, tool: recreateDesignTool, maxTokens: 4000, content: [...photos, { type: "text", text }] }));
}

export async function refineFromRender(photos: Image[], render: Image, design: unknown, round: number, notes?: string): Promise<Recreation | null> {
  const current = normalizeDesign(design);
  const text = [
    `${photos.length > 1 ? `The first ${photos.length} images are photos of the real piece.` : "The first image is a photo of the real piece."} The last image is our 3D build (check ${round}).`,
    notes ? `Notes from the person: ${notes}` : null,
    `The build's design now: ${JSON.stringify({ type: current.type, style: current.style, ...designForAi(current) })}`,
  ].filter(Boolean).join("\n");
  return tidy(await callTool({ system: REFINE_SYSTEM(), tool: recreateDesignTool, maxTokens: 4000, content: [...photos, render, { type: "text", text }] }));
}

export const jpegImage = (dataUrl: string): Image => ({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: dataUrl.replace(/^data:image\/jpeg;base64,/, "") } });
