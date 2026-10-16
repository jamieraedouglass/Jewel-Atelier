import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Every design you own (and its saved versions), as one JSON file you can keep as a backup. */
export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { data: designs } = await supabase.from("designs").select("id, name, data, created_at, updated_at").eq("owner", user.id).order("updated_at", { ascending: false });
  const { data: versions } = await supabase.from("design_versions").select("design_id, name, data, created_at").eq("owner", user.id).order("created_at", { ascending: false });
  const body = JSON.stringify({ app: "jewel-atelier", exportedAt: new Date().toISOString(), designs: designs ?? [], versions: versions ?? [] }, null, 1);
  const day = new Date().toISOString().slice(0, 10);
  return new NextResponse(body, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="jewel-atelier-designs-${day}.json"` } });
}
