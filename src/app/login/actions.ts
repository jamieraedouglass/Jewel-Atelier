"use server";

import { createHmac, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, hasSupabase } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";
import { emailForName, slugify } from "@/lib/names";

/**
 * Name-only sign-in. Each name maps to one account: the server derives a hidden email and password
 * from the name, so nobody types a password. Optional STUDIO_CODE keeps strangers out.
 */

function secretFor(slug: string) {
  const secret = process.env.NAME_LOGIN_SECRET;
  if (!secret || secret.length < 16) throw new Error("NAME_LOGIN_SECRET is missing. Add it under Vercel → Settings → Environment Variables (or .env.local when running locally), then redeploy.");
  return createHmac("sha256", secret).update(slug).digest("hex");
}

function codeMatches(given: string) {
  const want = process.env.STUDIO_CODE;
  if (!want) return true;
  const a = Buffer.from(given.trim().toLowerCase()), b = Buffer.from(want.trim().toLowerCase());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function signInWithName(_: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  const code = String(form.get("code") ?? "");
  const next = safeNext(form.get("next"));
  if (!hasSupabase()) return { error: "This studio isn't connected to its database yet, so nobody can sign in. The demo works in the meantime." };
  if (name.length < 2 || name.length > 40) return { error: "Use a name between 2 and 40 characters." };
  if (!codeMatches(code)) return { error: "That studio code isn't right." };
  const slug = slugify(name);
  if (!slug) return { error: "Use letters or numbers in your name." };

  const email = emailForName(name);
  let password: string;
  try { password = secretFor(slug); } catch (e) { return { error: (e as Error).message }; }

  const supabase = createClient();
  let { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    // first visit with this name: create the account, then sign in
    try {
      const admin = createAdminClient();
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
      if (created.error && !/already/i.test(created.error.message)) return { error: created.error.message };
    } catch (e) {
      return { error: (e as Error).message };
    }
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
    if (error) return { error: error.message };
  }
  redirect(next);
}
