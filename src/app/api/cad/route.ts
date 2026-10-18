import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeDesign } from "@/lib/design";
import { cadZip, modelParts, pieceRoot } from "@/lib/cadExport";
import { solidMetal } from "@/lib/cadSolid";
import { rhinoFile } from "@/lib/cad3dm";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ design: z.unknown() });
const WEEK = 7 * 24 * 3600;

export async function POST(req: Request) {
  const { user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in to download CAD files." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  const d = normalizeDesign(body.data.design);
  try {
    const parts = modelParts(d);
    let solid: Awaited<ReturnType<typeof solidMetal>> = null;
    try { solid = await solidMetal(pieceRoot(d)); }
    catch (e) { console.error("Joining the metal failed; sending the parts", e); }
    let extra: Record<string, Uint8Array> = {};
    try { extra = { "model.3dm": await rhinoFile(parts, d.name, solid?.geometry) }; }
    catch (e) {
      console.error("Rhino file failed; sending STLs only", e);
      extra = { "NO-RHINO-FILE.txt": new TextEncoder().encode("The Rhino (.3dm) file couldn't be made this time. The STL files here are complete; Rhino and MatrixGold import STL directly.") };
    }
    const zip = cadZip(d, extra, parts, solid);
    const name = `${d.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "design"}-CAD.zip`;
    const path = `${user.id}/${Date.now()}-${name}`;
    const admin = createAdminClient();
    const up = await admin.storage.from("cad").upload(path, zip, { contentType: "application/zip" });
    if (up.error) throw new Error(up.error.message);
    const signed = await admin.storage.from("cad").createSignedUrl(path, WEEK, { download: name });
    if (signed.error) throw new Error(signed.error.message);
    return NextResponse.json({ url: signed.data.signedUrl, name, sizeMb: Math.round(zip.length / 1e5) / 10 });
  } catch (e) {
    console.error("CAD export failed", e);
    return NextResponse.json({ error: "Couldn't make the CAD files." }, { status: 500 });
  }
}
