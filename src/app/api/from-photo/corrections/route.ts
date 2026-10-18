import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

const Body = z.object({
  piece: z.string().max(200).default(""),
  groups: z.array(z.object({ what: z.string().max(80), found: z.number().int().min(0).max(500), added: z.number().int().min(0).max(500), removed: z.number().int().min(0).max(500), where: z.array(z.string().max(40)).max(40) })).max(20),
});

// Saves what someone corrected in a photo reading (counts and rough positions only), so later readings can learn from it.
export async function POST(req: Request) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success || !body.data.groups.length) return NextResponse.json({ ok: false }, { status: 400 });
  const { error } = await supabase.from("reading_corrections").insert({ user_id: user.id, piece: body.data.piece, groups: body.data.groups });
  if (error) { console.error("Saving reading corrections failed:", error.message); return NextResponse.json({ ok: false }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
