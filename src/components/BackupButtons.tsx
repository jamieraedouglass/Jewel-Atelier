"use client";

import { useRef, useState } from "react";
import { importDesigns } from "@/app/actions";

/** Download every design as a backup file, or bring designs back from one. */
export default function BackupButtons() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function pick(f: File | undefined) {
    if (!f) return;
    setMsg("Bringing designs back…");
    const r = await importDesigns(await f.text());
    setMsg(r.error ?? `Added ${r.count} design${r.count === 1 ? "" : "s"} from the backup.`);
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <a className="btn" href="/api/export">Download a backup</a>
      <button type="button" className="btn" onClick={() => input.current?.click()}>Restore from a backup</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={(e) => pick(e.target.files?.[0])} />
      {msg && <span className="small muted" role="status">{msg}</span>}
    </div>
  );
}
