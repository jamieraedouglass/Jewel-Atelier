import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing. Copy the service_role key from Supabase → Project Settings → API into Vercel → Settings → Environment Variables (or .env.local locally), then redeploy.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
