import Anthropic from "@anthropic-ai/sdk";
import { MotifSchema } from "../design";

export const createMotifTool: Anthropic.Tool = {
  name: "create_motif",
  description: "Draw a flat jewellery motif (a gold plate shape) with stone positions. The app extrudes it in gold and sets the stones.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "e.g. 'Peacock with ruby eye'" },
      path: {
        type: "string",
        description:
          "SVG path data in a 0–100 × 0–100 box, y pointing down (the bottom of the drawing hangs lowest when worn). Use only M, L, C, Q, A and Z with absolute coordinates. Close every sub-path. Draw the outer silhouette first; extra sub-paths fully inside it become cut-outs (jaali). Keep it under 60 commands, smooth and symmetric where the motif is symmetric, filling most of the box.",
      },
      stones: {
        type: "array",
        description: "Stone positions in the same 0–100 coordinates. Each stone must sit fully inside the gold (not in a cut-out) and must not overlap another. One 'center' stone at the motif's focal point; 'accent' stones for borders, eyes, petals (radius 1.5–4).",
        items: {
          type: "object",
          properties: { x: { type: "number" }, y: { type: "number" }, r: { type: "number" }, kind: { type: "string", enum: ["center", "accent"] } },
          required: ["x", "y", "r", "kind"],
        },
      },
      edge: { type: "string", enum: ["smooth", "millegrain", "rope"] },
      enamel: { type: "boolean", description: "true if meenakari enamel suits this motif" },
      notes: { type: "string", description: "One or two sentences on the design and how a karigar would make it." },
    },
    required: ["name", "path", "stones", "edge", "enamel", "notes"],
  },
};

export const MOTIF_SYSTEM = `You are a jewellery designer and draughtsman who turns ideas and sketches into clean motif outlines for gold work:
paisley (kairi), peacock (mor), lotus (kamal), mango, elephant, temple and Mughal arches, crescents, stars, leaves, florals, monograms, Art Deco geometry.
Draw like a CAD designer: confident curves, balanced proportions, no stray points, no self-intersections. When tracing a sketch or photo,
follow its silhouette and the placement of stones you can see, simplifying wobbles. Always call create_motif exactly once.`;

export function toMotif(input: unknown) {
  const raw = input as { name?: string; path?: string; stones?: unknown[]; edge?: string; enamel?: boolean; notes?: string };
  const parsed = MotifSchema.safeParse({
    name: raw?.name, path: raw?.path, viewBox: [0, 0, 100, 100], edge: raw?.edge,
    stones: Array.isArray(raw?.stones) ? raw.stones.slice(0, 150) : [],
  });
  return parsed.success ? { motif: parsed.data, enamel: !!raw?.enamel, notes: raw?.notes ?? "" } : null;
}

