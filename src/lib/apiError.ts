import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export function aiFailure(e: unknown, what: string) {
  console.error(`${what} failed:`, e);
  if (e instanceof Anthropic.APIError && (e.status === 429 || e.status === 529 || e.status === 503))
    return NextResponse.json({ error: "The designer is busy right now. Please try again in a minute." }, { status: 503 });
  return NextResponse.json({ error: `${what} didn't work this time. Please try again.` }, { status: 500 });
}
