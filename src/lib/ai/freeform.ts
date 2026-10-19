import type Anthropic from "@anthropic-ai/sdk";
import { CUTS, type Freeform, FreeformPartSchema, FreeformPathSchema, FreeformSchema, GEMS, SHAPES } from "../design";
import { layoutFreeform } from "../freeform/layout";
import { checkLayout } from "../freeform/check";
import { type ImageBlock, callTool } from "./client";

// The AI's side of freeform design: one tool that writes the whole design in building blocks, the instructions that
// teach it how they work, and a reader that keeps what's usable when something comes back slightly wrong.

const look = {
  gem: { type: "string", enum: [...GEMS] },
  color: { type: "string", description: "Hex colour of the stone, e.g. #f4f6fb for a white diamond, #1b8a4c emerald, #0c2394 sapphire." },
  cut: { type: "string", enum: [...CUTS] },
  shape: { type: "string", enum: [...SHAPES] },
};
const pt = { type: "array", items: { type: "number" }, minItems: 2, maxItems: 3, description: "[x, y] or [x, y, h] in mm" };
const repeat = { type: "object", description: "Copies of this part turned round a point: a rosette of petals, a star of rays.", properties: { count: { type: "integer", minimum: 2, maximum: 24 }, around: pt }, required: ["count", "around"] };

export const freeformTool: Anthropic.Tool = {
  name: "design_freeform",
  description: "Write a jewellery design as building blocks: named lines, and parts that follow them (rows of stones, gold wire, plates) or sit at points (single stones, links). The app draws it as a sketch and builds it in 3D for casting.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string" },
      notes: { type: "string", description: "Two or three sentences for the workshop: what the piece is, how it would be made, and anything simplified from the brief or photos. Describe the piece, not yourself (no \"I\")." },
      mirror: { type: "boolean", description: "true for a symmetric design: draw only the right half (x >= 0) and anything on the centre line; it is copied to the left." },
      neckline: { type: "object", description: "Necklaces only: what goes round the neck (a line of stones can be 1–3 rows).", properties: { kind: { type: "string", enum: ["chain", "stones"] }, ...look, sizeMm: { type: "number" }, rows: { type: "integer", minimum: 1, maximum: 3 } } },
      top: { type: "string", enum: ["post", "hook"], description: "Earrings only." },
      paths: {
        type: "array", maxItems: 40,
        items: { type: "object", properties: { id: { type: "string" }, points: { type: "array", items: pt, minItems: 2, maxItems: 48 }, closed: { type: "boolean" } }, required: ["id", "points"] },
      },
      parts: {
        type: "array", maxItems: 60,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["row", "wire", "plate", "stone", "link"] },
            path: { type: "string" }, from: { type: "number" }, to: { type: "number" },
            ...look,
            sizeMm: { type: "number" }, sizeEndMm: { type: "number" }, set: { type: "string", enum: ["along", "across"] }, rows: { type: "integer" }, gapMm: { type: "number" },
            widthMm: { type: "number" }, finish: { type: "string", enum: ["plain", "milgrain", "rope"] },
            holes: { type: "array", items: { type: "string" } }, thicknessMm: { type: "number" }, domeMm: { type: "number" },
            pave: { type: "object", properties: { ...look, sizeMm: { type: "number" } } }, edge: { type: "string", enum: ["plain", "milgrain"] },
            at: pt, lengthMm: { type: "number" }, rotation: { type: "number" }, setting: { type: "string", enum: ["claw", "bezel"] },
            a: pt, b: pt,
            repeat,
          },
          required: ["kind"],
        },
      },
    },
    required: ["name", "notes", "mirror", "paths", "parts"],
  },
};

const WORN: Record<string, string> = {
  necklace: `A NECKLACE. y = 0 is the neckline at the centre front; x is measured along the neckline (it follows the neck's curve for you),
y runs down the chest. The neckline itself is supplied (a chain, or a line of stones: set "neckline"), so a part touching it hangs from
it. A line of stones is centred on y = 0, and each further row sits (sizeMm + 0.3) mm lower.
Front ornaments are typically 30–200 mm across and hang 10–120 mm.`,
  earrings: `EARRINGS. Draw ONE earring; the pair is made by mirroring it. (0, 0) is where it is worn: a post just behind the top, or a hook
("top"). It hangs down (y > 0). Earrings are typically 8–80 mm long and under 40 mm wide. Something must sit at (0, 0) for the post to hold:
a stone, a plate or the top of a link.`,
  ring: `A RING, seen from above and unrolled. x runs round the finger (across the hand), y runs along the finger (towards the fingertip is
negative). The band runs along x through y = 0; anything beyond about x = ±9 mm wraps down the shoulders. The top is typically up to 25 mm
along the finger. h lifts things off the band (a centre stone usually sits at h 0.5–2). The band is supplied.`,
};

export function freeformSystem(type: string) {
  return `You are a high-jewellery designer and CAD draughtsman. You turn a description or photographs into a buildable design written as
building blocks, in millimetres, at real size.

HOW IT IS WORN: ${WORN[type] ?? WORN.necklace}

THE DRAWING: x across (0 is the centre line, + to the right in the drawing), y down, h towards the viewer (height/doming,
default 0). Points are [x, y] or [x, y, h].

LINES (paths): named smooth curves through points (2–48 points; the curve passes through each point). closed: true for loops and outlines.
Use enough points to get the shape: a swag needs at least 3, a leaf outline 6–10, a circle 8.

PARTS:
- row: stones laid along a line (from/to as fractions of it, 0–1). sizeMm is the stone's width (short side); sizeEndMm graduates it to
  the end. set "along" lays a baguette/marquise/oval lengthways along the line, "across" sets it square to the line. rows: several rows side
  by side (a band of baguettes, a ribbon), spaced automatically. The app fits as many stones as the line holds.
- wire: gold wire along a line (widthMm 0.4–4); finish plain, milgrain (beaded) or rope.
- plate: gold plate filling a closed line, with holes (other closed lines, fully inside) for openwork; thicknessMm, domeMm to dome it;
  pave: covers it in small stones; edge milgrain.
- stone: one stone at a point, set on its own (claw or bezel): lengthMm × widthMm, rotation in degrees (0 = its length hangs straight
  down; a pear's point lowest).
- link: a bail or a short chain from a to b, for something that hangs (a drop, a pendant).
- repeat: on any part, copies turned round a point (petals, rays, a rosette).

RULES THAT MAKE IT BUILDABLE (the workshop will cast it):
- Everything must be joined into one piece: every row, plate, wire and stone must touch another part (or the neckline / post / band),
  overlapping by a fraction of a millimetre. A row's stones are joined to each other already. Stones sitting on a plate are held by it.
  To hang a row, wire or swag from something, start or end its line ON that thing (inside the stone's outline or the plate), not
  beside it: stones are fitted along the line from end to end, so a line that stops short leaves a gap.
- A row with several rows is centred on its line: the band of rows reaches half its width to each side of the line. Its width is
  rows × (each stone's reach across the row + 0.3 mm): sizeMm for "along", sizeMm × the shape's length-to-width ratio for "across"
  (a baguette is about 2.5 times as long as it is wide).
- Stones must not overlap each other. Leave about 0.2 mm between neighbours.
- Use real sizes: pavé and small rows 0.8–2.5 mm; baguettes 1.5–4 mm wide; centre stones 5–20 mm; drops 6–25 mm long.
- With mirror, draw only the right half (x >= 0) plus anything centred on x = 0; never draw both halves of a symmetric design.
- Prefer a few long lines with rows over many single stones. Never more than 60 parts.
- A cluster, knot or bow of stones is built from small stones (a plate with pavé, or a few short rows of baguettes), never shown as
  one oversized stone. Single stones are for stones that really are single: a centre stone, a drop.

FROM PHOTOGRAPHS: read the piece's real outline and proportions (judge size from any stated measurements, the stones, or a hand), the
lines its stones follow, how many rows, which stones are larger, where gold shows, and how it hangs. Reproduce its structure faithfully
rather than inventing; simplify only what the building blocks can't express, and say so in notes.

Call design_freeform exactly once with the complete design.`;
}

// Bring every number inside the range the design accepts, and drop what can't be used, rather than losing the design.
const LIMITS: Record<string, [number, number]> = {
  from: [0, 1], to: [0, 1], sizeMm: [0.6, 25], sizeEndMm: [0.6, 25], gapMm: [0, 6], widthMm: [0.4, 40], thicknessMm: [0.5, 4], domeMm: [0, 8],
  lengthMm: [1, 40], rotation: [-180, 180], rows: [1, 6],
};
function tidy(o: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...o };
  for (const [k, [lo, hi]] of Object.entries(LIMITS)) if (typeof out[k] === "number") out[k] = Math.min(hi, Math.max(lo, out[k] as number));
  if (out.kind !== "stone" && typeof out.widthMm === "number") out.widthMm = Math.min(4, out.widthMm as number);
  if (out.kind === "row" && typeof out.rows === "number") out.rows = Math.round(out.rows as number);
  const pointish = (p: unknown) => Array.isArray(p) && p.length >= 2 && p.slice(0, 3).every((v) => typeof v === "number") ? p.slice(0, 3).map((v, i) => Math.min(i === 2 ? 20 : 160, Math.max(i === 2 ? -20 : -160, v as number))) : p;
  for (const k of ["at", "a", "b"]) if (k in out) out[k] = pointish(out[k]);
  if (out.repeat && typeof out.repeat === "object") { const r = out.repeat as Record<string, unknown>; out.repeat = { count: Math.min(24, Math.max(2, Math.round(Number(r.count) || 2))), around: pointish(r.around ?? [0, 0]) }; }
  if (out.pave && typeof out.pave === "object") { const p = out.pave as Record<string, unknown>; if (typeof p.sizeMm === "number") p.sizeMm = Math.min(4, Math.max(0.7, p.sizeMm)); }
  return out;
}

export function toFreeform(input: unknown): Freeform | null {
  const raw = (input ?? {}) as Record<string, unknown>;
  const paths = (Array.isArray(raw.paths) ? raw.paths : []).slice(0, 40).map((p) => {
    const q = (p ?? {}) as Record<string, unknown>;
    const points = (Array.isArray(q.points) ? q.points : []).filter((x) => Array.isArray(x) && x.length >= 2).slice(0, 48).map((x) => (x as number[]).slice(0, 3).map((v, i) => Math.min(i === 2 ? 20 : 160, Math.max(i === 2 ? -20 : -160, Number(v) || 0))));
    return FreeformPathSchema.safeParse({ id: String(q.id ?? "").slice(0, 24), points, closed: !!q.closed });
  }).filter((r) => r.success).map((r) => r.data!);
  const ids = new Set(paths.map((p) => p.id));
  const parts = (Array.isArray(raw.parts) ? raw.parts : []).slice(0, 60).map((p) => FreeformPartSchema.safeParse(tidy((p ?? {}) as Record<string, unknown>)))
    .filter((r) => r.success).map((r) => r.data!)
    .map((p) => (p.kind === "plate" ? { ...p, holes: p.holes.filter((h) => ids.has(h)) } : p))
    .filter((p) => !("path" in p) || ids.has(p.path));
  if (!parts.length) return null;
  const neck = (raw.neckline ?? {}) as Record<string, unknown>;
  const base = {
    name: String(raw.name ?? "Unique piece").slice(0, 80), notes: String(raw.notes ?? "").slice(0, 1200), mirror: raw.mirror !== false,
    ...(raw.top === "hook" || raw.top === "post" ? { top: raw.top } : {}),
    paths, parts,
  };
  // A neckline it got wrong falls back to a plain chain rather than losing the design.
  const r = FreeformSchema.safeParse({ ...base, neckline: { ...neck, ...(typeof neck.sizeMm === "number" ? { sizeMm: Math.min(8, Math.max(1, neck.sizeMm)) } : {}), ...(typeof neck.rows === "number" ? { rows: Math.min(3, Math.max(1, Math.round(neck.rows))) } : {}) } });
  if (r.success) return r.data;
  const plain = FreeformSchema.safeParse(base);
  return plain.success ? plain.data : null;
}

// Draws a design (or changes one), checks it the way a bench jeweller would, and if anything is wrong gives it back
// once to be fixed, keeping the fixed version only if it is no worse.
export async function drawFreeform(opts: { type: string; images: ImageBlock[]; prompt?: string; current?: Freeform; change?: string; bandMm?: number; timeLeftMs?: number }) {
  const { type, images, prompt, current, change, bandMm } = opts;
  const ask = (text: string) => [...images.flatMap((p, i) => [{ type: "text" as const, text: `Photo ${i + 1}` }, p]), { type: "text" as const, text }];
  const brief = [
    prompt ? `The piece: ${prompt}` : null,
    images.length ? `${images.length > 1 ? `${images.length} photos of the piece` : "A photo of the piece"} above: recreate it faithfully.` : null,
    current ? `The current design:\n${JSON.stringify(current)}` : null,
    change ? `Change it like this, keeping everything else as it is: ${change}` : null,
  ].filter(Boolean).join("\n\n");
  const started = Date.now();
  const first = toFreeform(await callTool({ system: freeformSystem(type), tool: freeformTool, content: ask(brief), maxTokens: 16000, effort: "high" }));
  if (!first) return null;
  let design = first, issues = checkLayout(first, layoutFreeform(first), type, bandMm);
  if (issues.length && Date.now() - started < (opts.timeLeftMs ?? 150_000)) {
    const fix = [`${brief}\n\nYour design:\n${JSON.stringify(first)}`, `Checking it found these problems:\n- ${issues.join("\n- ")}`, "Fix them, changing as little else as possible, and give the whole corrected design."].join("\n\n");
    const fixed = toFreeform(await callTool({ system: freeformSystem(type), tool: freeformTool, content: ask(fix), maxTokens: 16000, effort: "medium" }));
    if (fixed) {
      const after = checkLayout(fixed, layoutFreeform(fixed), type, bandMm);
      if (after.length <= issues.length) { design = fixed; issues = after; }
    }
  }
  return { freeform: design, issues };
}

// For the designer chat: asks for a unique piece to be drawn (or the current one changed). The chat writes the brief;
// drawFreeform does the drawing, checking and fixing.
export const uniquePieceTool: Anthropic.Tool = {
  name: "design_unique_piece",
  description: "Have a unique piece drawn when the person wants a shape or construction the app's styles don't cover (a festoon, a garland, a spray of leaves, a particular antique or a piece they describe). It is drawn from jeweller's building blocks (rows of stones along lines, gold wire, plates with pavé or openwork, single stones, drops), checked, and offered to them as a sketch they can apply. Also use it to change the current piece when it is already a unique piece (style freeform).",
  input_schema: {
    type: "object",
    properties: {
      type: { type: "string", enum: ["necklace", "earrings", "ring"] },
      brief: { type: "string", description: "A full description for the draughtsman: the overall shape and size in mm, which stones go where (gem, cut, shape, sizes, how many rows), the gold work, how it hangs or sits, and the person's taste. When changing the current piece, say exactly what to change." },
      change_current: { type: "boolean", description: "true to change the current unique piece rather than draw a new one" },
    },
    required: ["type", "brief"],
  },
};
