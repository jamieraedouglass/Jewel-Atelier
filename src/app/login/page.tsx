"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const site = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
    const next = params.get("next") || "/design";
    const { error } = await createClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${site}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) { setError(error.message); setState("idle"); } else setState("sent");
  }

  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <h1>Sign in</h1>
      {state === "sent" ? (
        <p>Check {email} for a sign-in link. You can close this tab once you&apos;ve opened it.</p>
      ) : (
        <form onSubmit={submit} style={{ display: "grid", gap: 14 }}>
          <label className="field">
            <span>Email</span>
            <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <button className="btn primary" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Email me a sign-in link"}</button>
          {error && <p className="error">{error}</p>}
          <p className="muted small">No password needed. Anyone can view a shared ring; you only need an account to save, upload stones and chat.</p>
        </form>
      )}
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
