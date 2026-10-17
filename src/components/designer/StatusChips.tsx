"use client";

import Link from "next/link";
import { useState } from "react";
import { setDesignStatus } from "@/app/actions";
import { STATUSES, STATUS_LABEL, type Status } from "@/lib/inventory";

export default function StatusChips({ id, initial, onSaveFirst, flash }: { id: string | null; initial: Status; onSaveFirst: () => Promise<string | null>; flash: (msg: string) => void }) {
  const [status, setStatus] = useState(initial);
  async function pick(s: Status) {
    if (s === status) return;
    const designId = id ?? (await onSaveFirst());
    if (!designId) return;
    const before = status;
    setStatus(s);
    const r = await setDesignStatus(designId, s).catch(() => ({ error: "Couldn't change the status." }));
    if (r.error) { setStatus(before); flash(r.error); return; }
    flash(s === "made" ? "Marked as made. It's in your inventory now." : `Marked: ${STATUS_LABEL[s].toLowerCase()}.`);
  }
  return (
    <div className="chips" role="group" aria-label="Status">
      {STATUSES.map((s) => <button key={s} type="button" className="chip" aria-pressed={status === s} onClick={() => pick(s)}>{STATUS_LABEL[s]}</button>)}
      {status === "made" && <Link href="/inventory" className="small" style={{ alignSelf: "center" }}>Inventory →</Link>}
    </div>
  );
}
