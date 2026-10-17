import { NextResponse } from "next/server";
import { readPhotos, storageImages } from "@/lib/ai";
import { requireUser } from "@/lib/supabase/server";
import { chargeAiCall } from "@/lib/usage";
import { aiFailure } from "@/lib/apiError";
import { loadStyleProfile, photoKey } from "@/lib/style/load";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const profile = await loadStyleProfile(supabase, user.id);
  const paths = profile?.image_paths ?? [];
  const key = photoKey(paths);
  const store = (photo_read: string) => supabase.from("style_profiles").update({ photo_read, photo_read_key: key }).eq("user_id", user.id);
  if (!paths.length) { await store(""); return NextResponse.json({ read: "" }); }
  if (profile?.photoRead && profile.photoReadKey === key) return NextResponse.json({ read: profile.photoRead });

  const images = await storageImages(supabase, "inspiration", paths.slice(0, 8));
  if (!images.length) return NextResponse.json({ error: "Couldn't read the photos." }, { status: 400 });
  const charge = await chargeAiCall(supabase, user.id);
  if ("error" in charge) return NextResponse.json({ error: charge.error }, { status: 429 });
  try {
    const read = await readPhotos(images);
    if (!read) { await charge.refund(); return NextResponse.json({ error: "Couldn't describe the photos this time. Try again." }, { status: 502 }); }
    const { error } = await store(read);
    if (error) return NextResponse.json({ read, error: "Read the photos, but couldn't keep the result: run supabase/migrations/20261017_tracking_inventory_feedback.sql." });
    return NextResponse.json({ read });
  } catch (e) {
    await charge.refund();
    return aiFailure(e, "Reading your photos");
  }
}
