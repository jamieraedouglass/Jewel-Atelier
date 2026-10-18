import Anthropic from "@anthropic-ai/sdk";
import { TYPES } from "../design";
import { MODEL, anthropic } from "./client";

export const readPieceTool: Anthropic.Tool = {
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
          direction: { type: "string", enum: ["along the finger", "across the finger", "diagonal to the band", "not a ring or round stone"], description: "rings: which way the main stone's long axis runs compared with the FINGER (find the band first; ignore how the photo is tilted). Almost every ring is along or across." },
          photo: { type: "integer" }, x: { type: "number" }, y: { type: "number" }, w: { type: "number" }, h: { type: "number" },
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
              description: "one mark per stone you can see, on ONE piece: its centre (x, y from the photo's top-left, 0–1) and radius r as a fraction of the photo's width",
              items: { type: "object", properties: { photo: { type: "integer" }, x: { type: "number" }, y: { type: "number" }, r: { type: "number" } }, required: ["photo", "x", "y", "r"] },
            },
            count: { type: "integer", description: "how many there are in ONE piece, counted from your marks plus any you're sure are hidden" },
          },
          required: ["what", "shape", "ratio", "where", "marks", "count"],
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

export const READ_SYSTEM = `You are a master jeweller and gem setter mapping a piece of jewellery from photos before it is rebuilt in 3D.
Work like a bench jeweller counting stones under a loupe: look, mark each stone where it is, then count from your marks.
- First say what kind of piece it is. If the photo shows a pair, map ONE piece.
- Mark the main stone with a box (x, y = top-left corner, w, h; all 0–1 of the photo).
- For every other group of stones, mark each stone's centre where you actually see it. Never mark a stone you can't see,
  and never spread a group further round the main stone than it really goes.
- Judge sizes against the main stone (ratio) and say when sizes vary inside a group.
- Say exactly where each group sits relative to the main stone.
- Ask a question only when the answer would change the build and the photos can't settle it. Never ask what the photo shows.
The person's notes are facts; use them. Call read_piece once.`;

const FALLBACK = "claude-sonnet-5-5";

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
    const refused = e instanceof Anthropic.APIError && (e.status === 404 || e.status === 403 || (e.status === 400 && /model/i.test(e.message)));
    if (!refused || MODEL === FALLBACK) throw e;
    return run(FALLBACK);
  }
}
