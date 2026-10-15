"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { normalizeDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";

export async function saveDesign(id: string | null, raw: unknown): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in to save designs." };
  const data = normalizeDesign(raw);
  if (id) {
    const { error } = await supabase.from("designs").update({ data, name: data.name, updated_at: new Date().toISOString() }).eq("id", id).eq("owner", user.id);
    if (error) return { error: error.message };
    await keepVersion(supabase, id, data);
    revalidatePath(`/d/${id}`);
    revalidatePath("/rings");
    return { id };
  }
  const { data: row, error } = await supabase.from("designs").insert({ data, name: data.name }).select("id").single();
  if (error) return { error: error.message };
  await keepVersion(supabase, row.id, data);
  revalidatePath("/rings");
  return { id: row.id };
}

type Supa = Awaited<ReturnType<typeof requireUser>>["supabase"];

/** every save keeps a copy, so earlier versions can be brought back; only the newest 40 are kept */
async function keepVersion(supabase: Supa, designId: string, data: ReturnType<typeof normalizeDesign>) {
  try {
    await supabase.from("design_versions").insert({ design_id: designId, name: data.name, data });
    const { data: old } = await supabase.from("design_versions").select("id").eq("design_id", designId).order("created_at", { ascending: false }).range(40, 200);
    if (old?.length) await supabase.from("design_versions").delete().in("id", old.map((v) => v.id));
  } catch { /* versions are a convenience; never fail a save over them */ }
}

export async function listVersions(designId: string): Promise<{ id: string; name: string; created_at: string; data: unknown }[]> {
  const { supabase, user } = await requireUser();
  if (!user) return [];
  const { data } = await supabase.from("design_versions").select("id, name, created_at, data").eq("design_id", designId).order("created_at", { ascending: false }).limit(40);
  return data ?? [];
}

/** a copy of one of your designs (or of what is on screen), to try a variation without touching the original */
export async function duplicateDesign(raw: unknown): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in to make copies." };
  const src = normalizeDesign(raw);
  const data = { ...src, name: `${src.name.replace(/ \(copy( \d+)?\)$/, "")} (copy)`.slice(0, 80) };
  const { data: row, error } = await supabase.from("designs").insert({ data, name: data.name }).select("id").single();
  if (error) return { error: error.message };
  await keepVersion(supabase, row.id, data);
  revalidatePath("/rings");
  return { id: row.id };
}

export async function setThumbnail(id: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user || !path.startsWith(`${user.id}/`)) return;
  await supabase.from("designs").update({ thumbnail_path: path }).eq("id", id).eq("owner", user.id);
  revalidatePath("/rings");
}

export async function setPublic(id: string, isPublic: boolean) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await supabase.from("designs").update({ is_public: isPublic }).eq("id", id).eq("owner", user.id);
  revalidatePath(`/d/${id}`);
}

export async function deleteDesign(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) return;
  await supabase.from("designs").delete().eq("id", id).eq("owner", user.id);
  revalidatePath("/rings");
}

export async function copyDesign(id: string) {
  const { supabase, user } = await requireUser();
  if (!user) redirect(`/login?next=/d/${id}`);
  const { data: src } = await supabase.from("designs").select("data, name").eq("id", id).single();
  if (!src) redirect("/rings");
  const data = { ...normalizeDesign(src.data), name: `${src.name} (copy)` };
  if (src && (await supabase.from("designs").select("owner").eq("id", id).single()).data?.owner !== user.id) data.center.photoPath = null; // someone else's photo stays private
  const { data: row } = await supabase.from("designs").insert({ data, name: data.name }).select("id").single();
  redirect(row ? `/design/${row.id}` : "/rings");
}

export async function saveStyleProfile(input: { icons: string[]; notes: string; image_paths: string[] }): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  if (!user) return { error: "Sign in first." };
  const icons = input.icons.map((s) => s.trim()).filter(Boolean).slice(0, 12);
  const image_paths = input.image_paths.filter((p) => p.startsWith(`${user.id}/`)).slice(0, 12);
  const { error } = await supabase
    .from("style_profiles")
    .upsert({ user_id: user.id, icons, notes: input.notes.slice(0, 2000), image_paths, updated_at: new Date().toISOString() });
  return error ? { error: error.message } : {};
}
