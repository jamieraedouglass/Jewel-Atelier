import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The Claude client, model choice, images from storage, and the one-tool-call helper every feature uses. Server-only. */

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
