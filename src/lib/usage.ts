import type { SupabaseClient } from "@supabase/supabase-js";

export const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 40);

/** Counts one AI call against today's limit. Returns an error message if the limit is reached. */
export async function spendAiCall(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.rpc("use_ai_call", { daily_limit: DAILY_LIMIT });
  if (error) return `Couldn't check your daily AI limit: ${error.message}`;
  return data ? null : `You've used today's ${DAILY_LIMIT} AI requests. The limit resets at midnight (UTC).`;
}
