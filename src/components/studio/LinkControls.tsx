"use client";

import { useState } from "react";
import { extendLink, setLinkRevoked } from "@/app/studio/actions";

/** copy, open, turn off or extend a client link */
export default function LinkControls({ id, url, revoked, clientName }: { id: string; url: string; revoked: boolean; clientName: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const run = async (p: Promise<{ error?: string }>, ok: string) => { const r = await p.catch(() => ({ error: "Couldn't do that just now." })); setStatus(r.error ?? ok); };
  const wa = `https://wa.me/?text=${encodeURIComponent(`${clientName}, here are the pieces we discussed: ${url}`)}`;
  return (
    <div className="no-print" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button type="button" className="btn primary" onClick={() => navigator.clipboard.writeText(url).then(() => setStatus("Link copied"), () => setStatus(url))}>Copy link</button>
      <a className="btn" href={wa} target="_blank" rel="noopener">WhatsApp</a>
      <a className="btn" href={url} target="_blank" rel="noopener">Open as the client</a>
      {revoked
        ? <button type="button" className="btn" onClick={() => run(setLinkRevoked(id, false), "Link is on again")}>Turn back on</button>
        : <button type="button" className="btn" onClick={() => run(setLinkRevoked(id, true), "Link turned off")}>Turn off</button>}
      <button type="button" className="btn" onClick={() => run(extendLink(id, 30), "Open for another 30 days")}>+30 days</button>
      {status && <span className="small muted" role="status">{status}</span>}
    </div>
  );
}
