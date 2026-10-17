import { NextResponse } from "next/server";
import { z } from "zod";
import { loadClientBundle, saveClientVersion } from "@/lib/studio/server";

export const runtime = "nodejs";

const Body = z.object({ designId: z.string().uuid(), design: z.unknown() });

export async function POST(req: Request, { params }: { params: { token: string } }) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const bundle = await loadClientBundle(params.token);
  if (!bundle) return NextResponse.json({ error: "This link doesn't exist." }, { status: 404 });
  if (bundle.state !== "active") return NextResponse.json({ error: "This link has expired. Ask the jeweller for a new one." }, { status: 410 });
  const version = await saveClientVersion(bundle, body.data.designId, body.data.design);
  return version ? NextResponse.json({ version }) : NextResponse.json({ error: "That piece isn't in this link." }, { status: 404 });
}
