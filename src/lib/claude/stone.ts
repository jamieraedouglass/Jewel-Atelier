import Anthropic from "@anthropic-ai/sdk";
import { CUTS, DIAMOND_GRADE_IDS, GEMS, SHAPES } from "../design";

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
      diamond_color: { type: "string", enum: [...DIAMOND_GRADE_IDS, "fancy", "not a diamond"], description: "Diamonds only: the colour band the stone looks like (D-F colourless, G-J near colourless, K-M faint yellow, N-R very light yellow, S-Z light yellow, or fancy for a strongly coloured diamond). Judge against white areas in the photo, since lighting shifts colour; otherwise 'not a diamond'." },
      inclusions: { type: "number", description: "0 = eye-clean (nothing visible), 0.2 = a few small crystals or a feather, 0.5 = clearly included, 1 = heavily included or cloudy. Count only what the photos actually show; silk that makes a star counts lightly." },
      inclusion_notes: { type: "string", description: "One short sentence on what is visible (pinpoints, crystals, feathers, silk, clouds, surface chips or scratches), or 'none visible'." },
      phenomenon: { type: "string", enum: ["none", "star", "cats-eye", "colour-change"], description: "A visible star (asterism), a single bright band (cat's eye, chatoyancy), or a colour change between photos in different light. 'none' unless clearly seen." },
      star_rays: { type: "number", enum: [4, 6, 12], description: "For a star: how many rays (most star sapphires and rubies have 6)." },
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
Look closely at character too: a diamond's colour band (white or slightly yellow, judged against white things in the photo, since lighting shifts colour),
visible inclusions and blemishes, and optical effects such as a star or a cat's-eye band. Report only what the photos show; never infer a stone is
clean or included from its type. A star or cat's eye only appears on a cabochon: if you see one, the cut is cabochon.
If a style profile is given, add a short pairing suggestion that suits it; the profile never changes what you report about the stone.
Always call record_stone_analysis exactly once.`;
