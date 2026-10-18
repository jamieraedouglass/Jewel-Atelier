import { emailForName } from "./names";
import type { SupabaseClient } from "@supabase/supabase-js";

export function dailyLimit(raw = process.env.AI_DAILY_LIMIT): number {
  const n = Number(raw);
  return raw && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 40;
}
export const DAILY_LIMIT = dailyLimit();

export function powerUserEmails(raw = process.env.AI_POWER_USERS ?? ""): Set<string> {
  return new Set(raw.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (x.includes("@") ? x.toLowerCase() : emailForName(x))));
}

export function limitFor(email: string | null | undefined, rawUsers?: string, rawLimit = process.env.AI_POWER_LIMIT): number {
  if (!email || !powerUserEmails(rawUsers).has(email.toLowerCase())) return DAILY_LIMIT;
  const n = Number(rawLimit);
  return rawLimit && Number.isFinite(n) && n >= 1 ? Math.floor(n) : 300;
}

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

export async function spendAiCall(supabase: SupabaseClient): Promise<string | null> {
  const who = supabase.auth?.getUser ? await supabase.auth.getUser().catch(() => null) : null;
  const limit = limitFor(who?.data.user?.email);
  const { data, error } = await supabase.rpc("use_ai_call", { daily_limit: limit });
  if (error) return `Couldn't check your daily AI limit: ${error.message}`;
  return data ? null : `You've used today's ${limit} AI requests. The limit resets at midnight (UTC).`;
}
