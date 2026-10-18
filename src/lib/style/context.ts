import type { SupabaseClient } from "@supabase/supabase-js";
import { loadOwned, loadStyleProfile, loadTaste, photoKey, type StyleProfile } from "./load";
import { describeProfile, normalizePrefs } from "./profile";

export async function profileText(supabase: SupabaseClient, userId: string): Promise<string> {
  const [profile, taste, owned] = await Promise.all([loadStyleProfile(supabase, userId), loadTaste(supabase, userId), loadOwned(supabase, userId)]);
  if (!profile && !taste && !owned.length) return "";
  return describeProfile({
    prefs: profile?.prefs ?? normalizePrefs({}), icons: profile?.icons ?? [], notes: profile?.notes ?? "", taste,
    applied: profile?.applied, dismissed: profile?.dismissed, photoRead: profile && freshRead(profile) ? profile.photoRead : "", owned,
  });
}

export const freshRead = (p: StyleProfile) => !!p.photoRead && p.photoReadKey === photoKey(p.image_paths);
