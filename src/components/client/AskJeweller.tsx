"use client";

import { useState } from "react";
import type { ClientBackend } from "./backend";

/** A message straight to the jeweller: a quote, a change the tools don't cover, a question. */
export default function AskJeweller({ backend, designId, studioName }: { backend: ClientBackend; designId: string | null; studioName: string }) {
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  async function send() {
    if (!message.trim()) return;
    setState("sending");
    try { await backend.event(designId, "asked-jeweller", { message: message.trim() }); setState("sent"); setMessage(""); }
    catch { setState("error"); }
  }
  if (state === "sent") return <p className="small">Sent. {studioName} will be in touch.</p>;
  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p className="small muted" style={{ margin: 0 }}>For a price, a change these tools don&apos;t cover, or anything else: {studioName} sees your message along with the pieces exactly as you&apos;ve adjusted them.</p>
      <label className="field"><span>Your message</span>
        <textarea value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="Could this be made with a slightly thinner band? What would it cost in 22k?" />
      </label>
      <div><button type="button" className="btn primary" disabled={!message.trim() || state === "sending"} onClick={send}>{state === "sending" ? "Sending…" : "Send to the jeweller"}</button></div>
      {state === "error" && <p className="error">Couldn&apos;t send just now. Please try again.</p>}
    </div>
  );
}
