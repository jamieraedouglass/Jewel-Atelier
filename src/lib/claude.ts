import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BAND_FINISHES, CUTS, GEMS, METALS, SETTINGS, SHAPES, SIDE_KINDS } from "./design";

/** Server-only. The API key never reaches the browser. Created lazily so builds work without a key. */
let client: Anthropic | null = null;
export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set. Add it to .env.local.");
  return (client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
}
export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

type ImageBlock = Anthropic.ImageBlockParam;
const MEDIA = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Download private storage files and turn them into image blocks for Claude. */
export async function storageImages(supabase: SupabaseClient, bucket: string, paths: string[]): Promise<ImageBlock[]> {
  const out: ImageBlock[] = [];
  for (const path of paths) {
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) continue;
    const type = (MEDIA as readonly string[]).includes(data.type) ? (data.type as (typeof MEDIA)[number]) : "image/jpeg";
    const b64 = Buffer.from(await data.arrayBuffer()).toString("base64");
    out.push({ type: "image", source: { type: "base64", media_type: type, data: b64 } });
  }
  return out;
}

/* ---------- tool schemas ---------- */

export const stoneAnalysisTool: Anthropic.Tool = {
  name: "record_stone_analysis",
  description: "Record what can be seen about the gemstone in the photos.",
  input_schema: {
    type: "object",
    properties: {
      gem: { type: "string", enum: [...GEMS], description: "Most likely gem species from appearance. Use 'other' if unsure." },
      cut: { type: "string", enum: [...CUTS] },
      shape: { type: "string", enum: [...SHAPES], description: "Outline seen from above. Use the closest match." },
      color_hex: { type: "string", description: "Representative body colour as #rrggbb, ignoring reflections and highlights." },
      clarity: { type: "number", description: "0 = opaque, 1 = water-clear. Silky Burmese sapphire is ~0.3." },
      length_mm: { type: "number", description: "Estimated length in mm, if a scale reference (finger, coin, tweezers, ruler) is visible." },
      width_mm: { type: "number" },
      dome_mm: { type: "number", description: "Height above the girdle: dome height for a cabochon, crown height for a faceted stone." },
      size_basis: { type: "string", enum: ["scale reference", "carat weight", "guess"], description: "How the size was estimated." },
      label: { type: "string", description: "Short display name, e.g. 'Royal blue oval cabochon'." },
      observations: { type: "string", description: "Two to four plain sentences on colour, saturation, transparency, silk, inclusions, cut quality and symmetry." },
      cautions: { type: "array", items: { type: "string" }, description: "What photos cannot establish and should be confirmed by a lab or jeweller." },
      confidence: { type: "number", description: "0–1 overall confidence in the identification and measurements." },
    },
    required: ["gem", "cut", "shape", "color_hex", "clarity", "size_basis", "label", "observations", "cautions", "confidence"],
  },
};

export const STONE_SYSTEM = `You are a careful gemologist looking at photos or video frames of a single loose gemstone.
Report only what the images support. Never state origin (e.g. Burma, Kashmir) or treatment status (heated, unheated) as fact:
those require a lab report (GRS, Gübelin, SSEF, AGL, GIA), so if the person mentions them, repeat them as "stated by seller" and add a caution.
If the person gives a carat weight, set size_basis to "carat weight" and leave the mm fields empty; the app will compute dimensions.
If there is a clear scale reference, estimate mm dimensions from it. Otherwise give your best guess and set size_basis to "guess".
Always call record_stone_analysis exactly once.`;

const designPatchSchema = {
  type: "object",
  description: "Only the fields to change. Omit everything that should stay the same.",
  properties: {
    name: { type: "string" },
    center: {
      type: "object",
      properties: {
        gem: { type: "string", enum: [...GEMS] },
        cut: { type: "string", enum: [...CUTS] },
        shape: { type: "string", enum: [...SHAPES] },
        color: { type: "string", description: "#rrggbb" },
      },
    },
    sides: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...SIDE_KINDS] },
        sizeCt: { type: "number", description: "carat weight of each side stone, 0.05–3" },
      },
    },
    setting: {
      type: "object",
      properties: {
        style: { type: "string", enum: [...SETTINGS] },
        height: { type: "number", description: "0 = seated low into the shank, 1 = tall cathedral" },
      },
    },
    gallery: { type: "object", properties: { roseCut: { type: "boolean" } } },
    metal: { type: "string", enum: [...METALS] },
    band: {
      type: "object",
      properties: {
        widthMm: { type: "number", description: "1.5–6" },
        finish: { type: "string", enum: [...BAND_FINISHES] },
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

export const CHAT_SYSTEM = `You are a fine-jewellery design consultant inside a ring-design app.
You can see the ring being designed (as JSON) and, when provided, the person's style profile: inspiration photos, style icons and notes.
Ground every suggestion in that profile and in the centre stone's character. When the person names a style icon, draw on that person's
well-known, publicly documented jewellery taste in general terms (e.g. "quiet, heirloom-feeling pieces"); don't invent specific items they own.
Be specific and practical: proportions, cut pairings, setting height, wearability, what to ask the jeweller.
Keep replies short (under 150 words) and conversational. When you recommend a concrete change, call propose_design so they can apply it.
The app can only change the fields in propose_design; for anything else (engraving, milgrain, custom gallery work), describe it in words.
Never claim a stone's origin or treatment without a lab report.`;
