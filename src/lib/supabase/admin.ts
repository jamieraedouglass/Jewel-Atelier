import "server-only";
import { createClient } from "@supabase/supabase-js";

/** Service-role client: bypasses row-level security. Server only, used just to create name-based accounts. */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (Supabase → Project Settings → API).");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
