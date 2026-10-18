import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export function aiFailure(e: unknown, what: string) {
  console.error(`${what} failed:`, e);
  if (e instanceof Anthropic.APIError && (e.status === 429 || e.status === 529 || e.status === 503))
    return NextResponse.json({ error: "The designer is busy right now. Please try again in a minute." }, { status: 503 });
  const why = e instanceof Anthropic.APIError ? ` (AI service said ${e.status}: ${String(e.message).replace(/\s+/g, " ").slice(0, 140)})` : e instanceof Error ? ` (${e.message.slice(0, 140)})` : "";
  return NextResponse.json({ error: `${what} didn't work this time. Please try again.${why}` }, { status: 500 });
}
