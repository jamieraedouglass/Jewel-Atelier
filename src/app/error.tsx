"use client";

import { useEffect } from "react";

// After a deploy, a page left open asks for code files that no longer exist. Reloading picks up the new version.
const stale = (e: Error) => e.name === "ChunkLoadError" || /Loading (CSS )?chunk [\w-]+ failed/i.test(e.message);

function reloadOnce() {
  try {
    const last = Number(sessionStorage.getItem("chunk-reload") || 0);
    if (Date.now() - last < 30000) return false;
    sessionStorage.setItem("chunk-reload", String(Date.now()));
  } catch {
    /* storage blocked: reload anyway */
  }
  window.location.reload();
  return true;
}

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const updating = stale(error);
  useEffect(() => {
    if (updating) reloadOnce();
  }, [updating]);
  return (
    <main style={{ minHeight: "60vh", display: "grid", placeItems: "center", textAlign: "center", padding: 24 }}>
      <div style={{ display: "grid", gap: 12 }}>
        <p>{updating ? "Jewel Atelier was just updated. Loading the new version…" : "Something went wrong on this page."}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button className="btn" type="button" onClick={() => window.location.reload()}>Reload</button>
          {!updating && <button className="btn" type="button" onClick={reset}>Try again</button>}
        </div>
      </div>
    </main>
  );
}
