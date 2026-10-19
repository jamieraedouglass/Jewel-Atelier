import Anthropic from "@anthropic-ai/sdk";
import { TYPES } from "../design";
import { FALLBACK, MODEL, anthropic, modelRefused } from "./client";

const readPieceTool: Anthropic.Tool = {
  name: "read_piece",
  description: "Record a careful visual map of the jewellery in the photos: what kind of piece it is, the main stone, every group of stones with each stone marked where it is, and any questions that must be answered before it can be built accurately.",
  input_schema: {
    type: "object",
    properties: {
      piece: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...TYPES] },
          kind: { type: "string", description: "what it is in a few words, e.g. 'pair of pear diamond clip earrings with a briolette cluster'" },
          pair: { type: "boolean", description: "true when the photo shows a pair (describe ONE piece below)" },
          confidence: { type: "number", description: "0–1, how sure you are of the overall reading" },
        },
        required: ["type", "kind", "confidence"],
      },
      main: {
        type: "object",
        description: "the main (largest) stone of ONE piece",
        properties: {
          what: { type: "string" }, shape: { type: "string" }, cut: { type: "string" }, color: { type: "string" },
          size_mm: { type: "string", description: "estimated length x width in mm only, e.g. '15 x 8 mm'" },
          tip_clock: { type: "number", description: "pear, marquise, heart and other pointed stones: the clock hour the TIP points to in the photo (12 = straight up, 3 = right, 9 = left; 10.5 for half past ten), on the piece on the LEFT of the photo. Look at where the narrow point is, not the rounded end." },
          direction: { type: "string", enum: ["along the finger", "across the finger", "diagonal to the band", "not a ring or round stone"], description: "rings: which way the main stone's long axis runs compared with the FINGER (find the band first; ignore how the photo is tilted). Almost every ring is along or across." },
          photo: { type: "integer" },
          x: { type: "number", description: "left edge of the box round the main stone, in pixels of that photo" },
          y: { type: "number", description: "top edge, in pixels" }, w: { type: "number", description: "box width in pixels" }, h: { type: "number", description: "box height in pixels" },
        },
        required: ["what", "shape", "photo", "x", "y", "w", "h"],
      },
      groups: {
        type: "array",
        description: "every other group of stones in ONE piece, in the order you find them",
        items: {
          type: "object",
          properties: {
            what: { type: "string" }, shape: { type: "string" }, cut: { type: "string" }, color: { type: "string" },
            ratio: { type: "number", description: "a typical stone's length divided by the main stone's length, e.g. 0.25" },
            sizes_vary: { type: "string", description: "if they differ in size, how: e.g. '3 large (0.35) and 4 small (0.15)'" },
            where: { type: "string", description: "exactly where they sit relative to the main stone, e.g. 'tight cluster under the rounded end only, about 4 to 8 o'clock'" },
            marks: {
              type: "array",
              description: "one mark per stone you can see, on ONE piece: its centre (x, y in pixels of that photo, from its top-left corner) and its radius r in pixels. Put each mark on the stone itself, never on skin, background or bare metal.",
              items: { type: "object", properties: { photo: { type: "integer" }, x: { type: "number" }, y: { type: "number" }, r: { type: "number" } }, required: ["photo", "x", "y", "r"] },
            },
            count: { type: "integer", description: "how many there are in ONE piece, counted from your marks plus any you're sure are hidden" },
          },
          required: ["what", "shape", "ratio", "where", "marks", "count"],
        },
      },
      structure: {
        type: "object",
        description: "The piece's shape in 3D, read from EVERY photo (side, underside and worn photos especially), not just the top view. For rings this decides the profile, how the top meets the band and where the stones run.",
        properties: {
          top_outline: { type: "string", description: "outline of the whole top seen from above, e.g. 'rounded lozenge standing on its corner, points along the finger', 'oval', 'cushion'" },
          top_length_mm: { type: "number", description: "whole top along the finger" },
          top_width_mm: { type: "number", description: "whole top across the finger" },
          top_height_mm: { type: "number", description: "how far the top of the piece stands above the finger (side view)" },
          profile: { type: "string", enum: ["flat plaque", "gently domed", "high dome", "high dome curving down into the shoulders"], description: "the side view of the top" },
          stones_down_sides: { type: "boolean", description: "do the stones carry on down the sides of the top (not just across its face)?" },
          shoulders: { type: "string", enum: ["plain", "stones a short way down", "stones about a third of the way down", "stones halfway down", "stones all the way round"], description: "how far the stones run down the band from the top" },
          band_width_back_mm: { type: "number", description: "band width at the back of the finger (under the hand)" },
          band_width_shoulder_mm: { type: "number", description: "band width where it meets the top" },
          gallery: { type: "string", description: "underneath the top: e.g. 'open, pierced with engraved scrolls', 'solid', 'basket'" },
          notes: { type: "string", description: "anything else about the shape a jeweller would need: e.g. 'shoulders flare and sweep up into the dome like a saddle'" },
        },
      },
      overall: {
        type: "object",
        properties: { length_mm: { type: "number" }, width_mm: { type: "number" }, metal: { type: "string" }, setting: { type: "string", description: "how the stones are held: prongs, bezel, pavé..." } },
      },
      questions: {
        type: "array",
        maxItems: 3,
        description: "Only questions whose answer would change the build and that the photos can't answer (a hidden back, an ambiguous cut, an occluded count, ring or pendant?). Each with 2–4 short answer options. Empty when the photos are clear.",
        items: { type: "object", properties: { question: { type: "string" }, options: { type: "array", items: { type: "string" } } }, required: ["question", "options"] },
      },
    },
    required: ["piece", "main", "groups", "questions"],
  },
};

const READ_SYSTEM = `You are a master jeweller and gem setter mapping a piece of jewellery from photos before it is rebuilt in 3D.
Work like a bench jeweller counting stones under a loupe: look, mark each stone where it is, then count from your marks.
- First say what kind of piece it is. If the photo shows a pair, map ONE piece.
- Each photo's size in pixels is given just before it. Give every position in pixels of that photo, measured from its
  top-left corner. Mark the main stone with a box (x, y = top-left corner, w, h) that fits tightly round the stone.
- Before marking, find the piece in the photo: fingers, skin, cloth and background are not stones. Every mark must sit on a
  stone you can see, inside the outline of the piece.
- For every other group of stones, mark each stone's centre where you actually see it. Never mark a stone you can't see,
  and never spread a group further round the main stone than it really goes.
- Judge sizes against the main stone (ratio) and say when sizes vary inside a group.
- Drops in a cascade overlap: count and mark every one, front and back tier (a cluster of briolettes is often 12–20),
  and say where the largest hang. Small stones set right along a stone's edge are their own group.
- Follow each row along the stone's edge to where it really ends: rows of small stones and drops often run up the
  side almost to the tip of a pear. Mark every stone in the row, including the small ones near its ends; don't stop
  where the stones get small or hard to see. Your marks place the stones in the 3D build exactly where you put them.
- Say exactly where each group sits relative to the main stone.
- Read the 3D shape from all the photos, not just the top view: side and underside photos show the profile, how high
  the top stands, how it curves down into the shoulders, how far the stones run down the band, the band's width at the
  back and at the shoulders, and the gallery underneath. Fill in structure from them.
- Ask a question only when the answer would change the build and the photos can't settle it. Never ask what the photo shows.
The person's notes are facts; use them. Call read_piece once.`;

export async function streamReading(content: Anthropic.MessageParam["content"], onSnapshot: (s: unknown) => void): Promise<unknown | null> {
  const run = async (model: string) => {
    const stream = anthropic().messages.stream({
      model,
      max_tokens: 16000,
      output_config: { effort: "high" },
      system: READ_SYSTEM,
      tools: [{ ...readPieceTool, eager_input_streaming: true } as Anthropic.Tool],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content }],
    });
    stream.on("inputJson", (_delta, snapshot) => onSnapshot(snapshot));
    const msg = await stream.finalMessage();
    const call = msg.content.find((b) => b.type === "tool_use");
    return call && "input" in call ? call.input : null;
  };
  try {
    return await run(MODEL);
  } catch (e) {
    if (!modelRefused(e) || MODEL === FALLBACK) throw e;
    return run(FALLBACK);
  }
}

export type PhotoSize = { w: number; h: number };

// Reads width and height from a JPEG or PNG header.
export function imageSize(bytes: Uint8Array): PhotoSize | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes.length > 24) {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { w: v.getUint32(16), h: v.getUint32(20) };
  }
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < bytes.length) {
    if (bytes[i] !== 0xff) { i++; continue; }
    const marker = bytes[i + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
    const len = (bytes[i + 2] << 8) | bytes[i + 3];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
      return { h: (bytes[i + 5] << 8) | bytes[i + 6], w: (bytes[i + 7] << 8) | bytes[i + 8] };
    i += 2 + len;
  }
  return null;
}

type Pt = { photo?: unknown; x?: unknown; y?: unknown; r?: unknown; w?: unknown; h?: unknown };
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

// The model marks stones in pixels; the page draws them as fractions of each photo. Values that are already fractions stay.
export function marksToFractions(reading: unknown, sizes: (PhotoSize | null)[]): unknown {
  if (!reading || typeof reading !== "object") return reading;
  const r = structuredClone(reading) as { main?: Pt; groups?: { marks?: Pt[] }[] };
  const pts: Pt[] = [...(r.main ? [r.main] : []), ...(r.groups ?? []).flatMap((g) => (Array.isArray(g?.marks) ? g.marks : []))];
  const pixels = pts.some((p) => [p.x, p.y, p.w, p.h].some((v) => (n(v) ?? 0) > 1.5));
  if (!pixels) return r;
  for (const p of pts) {
    const size = sizes[n(p.photo) ?? 0] ?? sizes[0];
    if (!size) continue;
    if (n(p.x) !== null) p.x = (p.x as number) / size.w;
    if (n(p.w) !== null) p.w = (p.w as number) / size.w;
    if (n(p.r) !== null) p.r = (p.r as number) / size.w;
    if (n(p.y) !== null) p.y = (p.y as number) / size.h;
    if (n(p.h) !== null) p.h = (p.h as number) / size.h;
  }
  return r;
}
