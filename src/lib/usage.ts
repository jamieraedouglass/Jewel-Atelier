import type { SupabaseClient } from "@supabase/supabase-js";

/** AI calls per person per day; a missing or nonsensical AI_DAILY_LIMIT falls back to 40 rather than locking everyone out */
export function dailyLimit(raw = process.env.AI_DAILY_LIMIT): number {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 40;
}
export const DAILY_LIMIT = dailyLimit();

/**
 * Charge one AI call for this request. Returns an error message if today's limit is reached, otherwise a `refund`
 * to call if the request then fails, so a failed or unusable reply doesn't use up one of the day's calls.
 */
export async function chargeAiCall(supabase: SupabaseClient, userId: string): Promise<{ error: string } | { refund: () => Promise<void> }> {
  const limited = await spendAiCall(supabase);
  if (limited) return { error: limited };
  let refunded = false;
  return {
    refund: async () => {
      if (refunded) return;
      refunded = true;
      try {
        const { createAdminClient } = await import("./supabase/admin");
        const { error } = await createAdminClient().rpc("refund_ai_call", { uid: userId });
        if (error) console.warn("AI call refund failed (has supabase/migrations/20261016_refund_ai_call.sql been run?):", error.message);
      } catch (e) {
        console.warn("AI call refund failed:", e);
      }
    },
  };
}

/** Counts one AI call against today's limit. Returns an error message if the limit is reached. */
export async function spendAiCall(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("use_ai_call", { daily_limit: DAILY_LIMIT });
  if (error) return `Couldn't check your daily AI limit: ${error.message}`;
  return data ? null : `You've used today's ${DAILY_LIMIT} AI requests. The limit resets at midnight (UTC).`;
}
