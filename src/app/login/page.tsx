"use client";

import { Suspense } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useSearchParams } from "next/navigation";
import { signInWithName } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn primary" disabled={pending}>{pending ? "Opening your studio…" : "Continue"}</button>;
}

function LoginForm() {
  const params = useSearchParams();
  const [state, action] = useFormState(signInWithName, null);
  const needsCode = process.env.NEXT_PUBLIC_STUDIO_CODE_REQUIRED === "true";
  return (
    <main className="page" style={{ maxWidth: 440 }}>
      <h1>Sign in</h1>
      <form action={action} style={{ display: "grid", gap: 14 }}>
        <input type="hidden" name="next" value={params.get("next") || "/design"} />
        <label className="field" htmlFor="name">
          <span>Your name</span>
          <input id="name" name="name" type="text" required minLength={2} maxLength={40} autoComplete="nickname" placeholder="e.g. Jamie" />
        </label>
        {needsCode && (
          <label className="field" htmlFor="code">
            <span>Studio code</span>
            <input id="code" name="code" type="text" required autoComplete="off" />
          </label>
        )}
        <Submit />
        {state?.error && <p className="error">{state.error}</p>}
        <p className="muted small">
          No password. The same name always opens the same account, with your saved designs and style profile, on any device.
        </p>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
