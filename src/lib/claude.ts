import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MotifSchema } from "./design";
import { ALL_STYLES, BANGLE_SIZES, BAND_FINISHES, CHAIN_STYLES, CUTS, DROP_ARRANGE, DROP_KINDS, GEMS, METALS, SETTINGS, SHAPES, SIDE_KINDS, STYLES, TYPES, TYPE_LABEL } from "./design";

/** "ring: three-stone, solitaire, …; earrings: …" so Claude knows which styles belong to which type */
const STYLE_GUIDE = TYPES.map((t) => `${t} (${TYPE_LABEL[t]}): ${Object.entries(STYLES[t]).map(([k, s]) => `${k} — ${s.blurb}`).join("; ")}`).join("\n");

/** Server-only. The API key never reaches the browser. Created lazily so builds work without a key. */
let client: Anthropic | null = null;
export function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is missing. Add it under Vercel → Settings → Environment Variables (or .env.local locally), then redeploy.");
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

const gemProp = { type: "string", enum: [...GEMS] };
const hexProp = { type: "string", description: "#rrggbb" };
const designPatchSchema = {
  type: "object",
  description: "Only the fields to change. Omit everything that should stay the same. To change the piece type or style, set both type and style.",
  properties: {
    name: { type: "string" },
    type: { type: "string", enum: [...TYPES] },
    style: { type: "string", enum: ALL_STYLES, description: `Must belong to the type. ${STYLE_GUIDE}` },
    center: { type: "object", properties: { gem: gemProp, cut: { type: "string", enum: [...CUTS] }, shape: { type: "string", enum: [...SHAPES] }, color: hexProp, lengthMm: { type: "number" }, widthMm: { type: "number" }, rotation: { type: "number", description: "degrees the stone is turned in its setting" } } },
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
    accents: { type: "object", properties: { gem: gemProp, color: hexProp, cut: { type: "string", enum: ["faceted", "polki", "rose-cut"] }, sizeCt: { type: "number", description: "each, 0.005–6" }, shapes: { type: "array", items: { type: "string", enum: [...SHAPES] }, description: "tennis styles: 1–12 shapes repeated in order, e.g. [\"round\",\"round\",\"round\",\"marquise\"]" }, orientation: { type: "string", enum: ["along", "across", "alternate"] }, turns: { type: "array", items: { type: "number" }, description: "extra turn in degrees for each stone in shapes, by position, so some stones point one way and others another (e.g. shapes [round, round, marquise] with turns [0, 0, 90])" }, twins: { type: "array", items: { type: "boolean" }, description: "by position: true sets two stones side by side there (twin baguettes between rounds)" }, sizes: { type: "array", items: { type: "number" }, description: "by position: size multiple of each stone, e.g. [2, 1, 1.2, 1] for big round, small round, baguette, small round" } } },
    frames: {
      type: "array",
      description: "ring/earring style deco: layers round the centre stone, inside out. Replaces the whole list.",
      items: { type: "object", properties: {
        kind: { type: "string", enum: ["stones", "milgrain", "metal"] }, outline: { type: "string", enum: [...SHAPES], description: "the layer's shape: round, octagon, hexagon, cushion…" },
        gem: gemProp, color: hexProp, cut: { type: "string", enum: [...CUTS] }, shape: { type: "string", enum: [...SHAPES], description: "stone shape: round pavé, princess/baguette calibré, pear/oval petals" },
        widthMm: { type: "number" }, direction: { type: "string", enum: ["along", "radial"], description: "radial = fanning out from the centre (calibré, ballerina, petals)" },
        alt: { type: "object", properties: { gem: gemProp, color: hexProp, shape: { type: "string", enum: [...SHAPES] }, cut: { type: "string", enum: [...CUTS] } }, description: "stripes of a second gem" },
        every: { type: "integer", description: "stones of the first gem between each second-gem stone" }, gapMm: { type: "number" },
      } },
    },
    fringe: { type: "object", properties: { enabled: { type: "boolean" }, gem: gemProp, color: hexProp, sizeMm: { type: "number", description: "1.5–14" } } },
    enamel: { type: "object", properties: { enabled: { type: "boolean" }, color: hexProp } },
    metal: { type: "string", enum: [...METALS] },
    purity: { type: "object", properties: { karat: { type: "number", enum: [14, 18, 22, 24] } } },
    setting: { type: "object", properties: { style: { type: "string", enum: [...SETTINGS] }, height: { type: "number", description: "rings only: 0 low … 1 tall" } } },
    sides: { type: "object", properties: { kind: { type: "string", enum: [...SIDE_KINDS] }, sizeCt: { type: "number" }, hug: { type: "boolean", description: "sized to the centre and set tight against it (classic half-moon trilogy)" }, hugFrac: { type: "number", description: "0.4–1, how much of the centre's length the sides cover" } } },
    gallery: { type: "object", properties: { roseCut: { type: "boolean" } } },
    band: { type: "object", properties: { widthMm: { type: "number" }, finish: { type: "string", enum: [...BAND_FINISHES] }, profile: { type: "string", enum: ["raised", "low", "set-in"], description: "the design up on top of the band, low on it, or set into a band that widens to hold it (Deco plaques, cigar bands, flush settings)" }, shape: { type: "string", enum: ["classic", "flat", "cigar"] }, pave: { type: "string", enum: ["none", "shoulders", "half", "full"], description: "stones running down the band" }, paveRows: { type: "integer" }, paveGem: gemProp, paveShape: { type: "string", enum: [...SHAPES] }, paveMm: { type: "number" } } },
    options: {
      type: "object",
      properties: {
        halo: { type: "boolean" }, accentTop: { type: "boolean" }, pave: { type: "boolean" },
        hoopDiameterMm: { type: "number" }, hoopShape: { type: "string", enum: ["round", "oval", "paperclip"] }, linkStyle: { type: "string", enum: ["x", "chevron"], description: "gold collar links" }, lengthIn: { type: "number", description: "necklace length in inches, 12–40" },
        chain: { type: "string", enum: [...CHAIN_STYLES] }, count: { type: "integer", description: "stones, stations, tiers, strands or bells depending on style" },
        layers: { type: "integer", description: "rows or strands, 1–7" }, bangleSize: { type: "string", enum: [...BANGLE_SIZES] },
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
You can see the piece being designed (as JSON) and, when provided, the person's style profile: inspiration photos, style icons and notes.
Ground every suggestion in that profile and in the centre stone's character. When the person names a style icon, draw on that person's
well-known, publicly documented jewellery taste in general terms (e.g. "quiet, heirloom-feeling pieces"); don't invent specific items they own.
Be specific and practical: proportions, cut pairings, setting height, wearability, what to ask the jeweller.
Keep replies short (under 150 words) and conversational. When you recommend a concrete change, call propose_design so they can apply it.
When they want a shape the styles don't cover (a peacock, a monogram, a lotus, an Art Deco fan), call create_motif to draw it.
The app can only change the fields in propose_design and create_motif; for anything else (filigree, nakashi, engraving, jadau detailing, sahara ear chains), describe it in words.
Never claim a stone's origin or treatment without a lab report.`;

/* ---------- custom motifs ---------- */

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

/** Claude's tool output → a validated motif, or null */
export function toMotif(input: unknown) {
  const raw = input as { name?: string; path?: string; stones?: unknown[]; edge?: string; enamel?: boolean; notes?: string };
  const parsed = MotifSchema.safeParse({
    name: raw?.name, path: raw?.path, viewBox: [0, 0, 100, 100], edge: raw?.edge,
    stones: Array.isArray(raw?.stones) ? raw.stones.slice(0, 150) : [],
  });
  return parsed.success ? { motif: parsed.data, enamel: !!raw?.enamel, notes: raw?.notes ?? "" } : null;
}


/* ---------- recreate a whole piece from a photo ---------- */

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
Estimate sizes in millimetres from typical proportions (an earring is usually 15–70 mm long; a stud 5–15 mm) or any scale reference.
Set metal from the colour of the gold. Never state a stone's origin or treatment. Always call recreate_design exactly once.`;

/**
 * Ask for one tool call and return its input. Some models refuse a forced tool_choice, so this asks politely
 * (tool_choice auto) and, if the reply is only text, asks once more to call the tool.
 */
export async function callTool(opts: { system: string; tool: Anthropic.Tool; content: Anthropic.MessageParam["content"]; maxTokens?: number }): Promise<unknown | null> {
  const messages: Anthropic.MessageParam[] = [{ role: "user", content: opts.content }];
  for (let attempt = 0; attempt < 2; attempt++) {
    const msg = await anthropic().messages.create({
      model: MODEL,
      max_tokens: opts.maxTokens ?? 2000,
      system: `${opts.system}\n\nReply by calling the ${opts.tool.name} tool exactly once.`,
      tools: [opts.tool],
      tool_choice: { type: "auto" },
      messages,
    });
    const call = msg.content.find((b) => b.type === "tool_use");
    if (call && "input" in call) return call.input;
    messages.push({ role: "assistant", content: msg.content }, { role: "user", content: `Please call the ${opts.tool.name} tool now with your answer.` });
  }
  return null;
}
