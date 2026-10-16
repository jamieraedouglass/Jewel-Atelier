import Anthropic from "@anthropic-ai/sdk";
import { anthropic, MODEL } from "./client";

/** Reading someone's inspiration photos once, into a few sentences the design consultant can use every time. */

export const PHOTO_READ_SYSTEM = `You are a fine-jewellery stylist reading a client's inspiration photos (jewellery, outfits, interiors, anything).
Describe the taste they show, for a designer who will not see the photos: metals and colours, stone types and cuts, scale and weight,
era and influences (Art Deco, Mughal, minimal, bridal…), recurring motifs and shapes, and the overall feeling. Mention anything that
stands out in particular photos briefly. Write 4–7 plain sentences, no lists, no preamble. Describe taste only: never identify people.`;

/** a few sentences on the taste the photos show, or "" if Claude sends nothing back */
export async function readPhotos(images: Anthropic.ImageBlockParam[]): Promise<string> {
  const msg = await anthropic().messages.create({
    model: MODEL,
    max_tokens: 600,
    system: PHOTO_READ_SYSTEM,
    messages: [{ role: "user", content: [...images, { type: "text", text: `These are ${images.length} inspiration photo(s). What taste do they show?` }] }],
  });
  return msg.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim().slice(0, 2000);
}
