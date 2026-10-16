import Anthropic from "@anthropic-ai/sdk";
import { CUTS, GEMS, SHAPES } from "../design";

/** Reading a loose stone from photos. */

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
      pairing: { type: "string", description: "Only when a style profile is given: one or two sentences on how this stone could be set to suit that person (style, metal, accents)." },
    },
    required: ["gem", "cut", "shape", "color_hex", "clarity", "size_basis", "label", "observations", "cautions", "confidence"],
  },
};

export const STONE_SYSTEM = `You are a careful gemologist looking at photos or video frames of a single loose gemstone.
Report only what the images support. Never state origin (e.g. Burma, Kashmir) or treatment status (heated, unheated) as fact:
those require a lab report (GRS, Gübelin, SSEF, AGL, GIA), so if the person mentions them, repeat them as "stated by seller" and add a caution.
If the person gives a carat weight, set size_basis to "carat weight" and leave the mm fields empty; the app will compute dimensions.
If there is a clear scale reference, estimate mm dimensions from it. Otherwise give your best guess and set size_basis to "guess".
If a style profile is given, add a short pairing suggestion that suits it; the profile never changes what you report about the stone.
Always call record_stone_analysis exactly once.`;
