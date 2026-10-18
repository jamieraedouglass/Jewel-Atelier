import type { SupabaseClient } from "@supabase/supabase-js";
import { describeDesign, normalizeDesign } from "../design";
import { normalizeInventory, normalizeStatus, tasteWeight } from "../inventory";
import { normalizePrefs, summarizeTaste, type StylePrefs, type Taste } from "./profile";

export type StyleProfile = {
  icons: string[]; notes: string; image_paths: string[]; prefs: StylePrefs;
  applied: string[]; dismissed: string[];
  photoRead: string; photoReadKey: string;
};

export const photoKey = (paths: string[]) => [...paths].sort().join("|");

const strings = (v: unknown, max = 20) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").slice(0, max) : []);

export async function loadStyleProfile(supabase: SupabaseClient, userId: string): Promise<StyleProfile | null> {
  const attempts = [
    "icons, notes, image_paths, prefs, applied, dismissed, photo_read, photo_read_key",
    "icons, notes, image_paths, prefs, applied",
    "icons, notes, image_paths",
  ];
  for (const cols of attempts) {
    const { data, error } = await supabase.from("style_profiles").select(cols).eq("user_id", userId).maybeSingle();
    if (error) continue;
    if (!data) return null;
    const row = data as unknown as Record<string, unknown>;
    return {
      icons: strings(row.icons, 12), notes: typeof row.notes === "string" ? row.notes : "", image_paths: strings(row.image_paths, 12),
      prefs: normalizePrefs(row.prefs), applied: strings(row.applied), dismissed: strings(row.dismissed),
      photoRead: typeof row.photo_read === "string" ? row.photo_read : "", photoReadKey: typeof row.photo_read_key === "string" ? row.photo_read_key : "",
    };
  }
  return null;
}

export async function loadTaste(supabase: SupabaseClient, userId: string): Promise<Taste | null> {
  const recent = (cols: string) => supabase.from("designs").select(cols).eq("owner", userId).order("updated_at", { ascending: false }).limit(80);
  let res = await recent("data, status, updated_at");
  if (res.error) res = await recent("data, updated_at");
  if (res.error || !res.data?.length) return null;
  const rows = res.data as unknown as { data: unknown; status?: string; updated_at?: string }[];
  const statuses = rows.map((r) => normalizeStatus(r.status));
  return summarizeTaste(rows.map((r) => normalizeDesign(r.data)), rows.map((r, i) => tasteWeight(statuses[i], r.updated_at)), statuses.filter((s) => s === "made").length);
}

export async function loadOwned(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase.from("designs").select("name, data, inventory").eq("owner", userId).eq("status", "made").order("made_at", { ascending: false, nullsFirst: false }).limit(20);
  if (error || !data) return [];
  return (data as { name: string; data: unknown; inventory: unknown }[]).map((r) => ({ name: r.name, summary: describeDesign(normalizeDesign(r.data)), notes: normalizeInventory(r.inventory).notes }));
}
