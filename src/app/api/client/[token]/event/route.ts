import { NextResponse } from "next/server";
import { z } from "zod";
import { linkByToken, recordEvent } from "@/lib/studio/server";
import { linkState } from "@/lib/studio/links";

export const runtime = "nodejs";

const Body = z.object({
  designId: z.string().uuid().nullable().default(null),
  kind: z.enum(["tried-on", "compared", "asked-jeweller"]),
  /** a message for the jeweller and how to reach them (asked-jeweller only) */
  message: z.string().trim().max(1000).default(""),
});

/** something a client did that the jeweller should see: tried a piece on, compared pieces, asked the jeweller */
export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const link = await linkByToken(params.token);
  if (!link || linkState(link) !== "active") return NextResponse.json({ error: "This link isn't active." }, { status: 410 });
  if (body.data.designId && !link.design_ids.includes(body.data.designId)) return NextResponse.json({ error: "That piece isn't in this link." }, { status: 404 });
  const { kind, message } = body.data;
  await recordEvent(link.id, body.data.designId, kind, kind === "asked-jeweller" ? { message } : {});
  return NextResponse.json({ ok: true });
}
