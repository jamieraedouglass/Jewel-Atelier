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
    revalidatePath(`/d/${id}`);
    revalidatePath("/rings");
    return { id };
  }
  const { data: row, error } = await supabase.from("designs").insert({ data, name: data.name }).select("id").single();
  if (error) return { error: error.message };
  revalidatePath("/rings");
  return { id: row.id };
}

export async function setThumbnail(id: string, path: string) {
  const { supabase, user } = await requireUser();
  if (!user || !path.startsWith(`${user.id}/`)) return;
  await supabase.from("designs").update({ thumbnail_path: path }).eq("id", id).eq("owner", user.id);
  revalidatePath("/rings");
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
  data.center.photoPath = null; // the original photo stays private to its owner
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
