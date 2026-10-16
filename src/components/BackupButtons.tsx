"use client";

import { useRef, useState } from "react";
import { importDesigns } from "@/app/actions";

/** Download every design as a backup file, or bring designs back from one. */
export default function BackupButtons() {
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = ""; // so choosing the same file again still works
    if (!f) return;
    if (f.size > 1.9 * 1024 * 1024) { setMsg("That backup is too big to restore in one go (the limit is about 2 MB)."); return; }
    setMsg("Bringing designs back…");
    try {
      const r = await importDesigns(await f.text());
      if (r.error) { setMsg(r.error); return; }
      const skipped = r.skipped ? ` ${r.skipped} couldn't be read and ${r.skipped === 1 ? "was" : "were"} left out.` : "";
      setMsg(`Added ${r.count} design${r.count === 1 ? "" : "s"} from the backup.${skipped}`);
    } catch {
      setMsg("Couldn't restore that backup. Check your connection and try again.");
    }
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <a className="btn" href="/api/export">Download a backup</a>
      <button type="button" className="btn" onClick={() => input.current?.click()}>Restore from a backup</button>
      <input ref={input} type="file" accept="application/json,.json" hidden onChange={pick} />
      {msg && <span className="small muted" role="status">{msg}</span>}
    </div>
  );
}
