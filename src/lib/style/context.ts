import type { SupabaseClient } from "@supabase/supabase-js";
import { loadStyleProfile, loadTaste, photoKey, type StyleProfile } from "./load";
import { describeProfile, normalizePrefs } from "./profile";

/**
 * The profile as text for features that don't send the inspiration photos themselves (recreate from a photo, motif
 * drawing, stone analysis): preferences, taste from their designs, feedback, and the written read of their photos.
 */
export async function profileText(supabase: SupabaseClient, userId: string): Promise<string> {
  const [profile, taste] = await Promise.all([loadStyleProfile(supabase, userId), loadTaste(supabase, userId)]);
  if (!profile && !taste) return "";
  return describeProfile({
    prefs: profile?.prefs ?? normalizePrefs({}), icons: profile?.icons ?? [], notes: profile?.notes ?? "", taste,
    applied: profile?.applied, dismissed: profile?.dismissed, photoRead: profile && freshRead(profile) ? profile.photoRead : "",
  });
}

/** whether the written read still describes the photos they have now */
export const freshRead = (p: StyleProfile) => !!p.photoRead && p.photoReadKey === photoKey(p.image_paths);
