"use client";

import { useState } from "react";
import { setLinkPricing } from "@/app/studio/actions";
import type { Allow } from "@/lib/studio/links";
import type { Pricing } from "@/lib/studio/pricing";
import PriceEditor, { filledPricing } from "./PriceEditor";

/** a sent link's prices, editable: the client sees the new prices next time they look */
export default function LinkPricing({ id, pieces, allow, initial }: { id: string; pieces: { id: string; name: string }[]; allow: Allow; initial: Pricing }) {
  const [value, setValue] = useState<Pricing>(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  async function save() {
    setState("saving");
    const r = await setLinkPricing(id, filledPricing(value)).catch(() => ({ error: "failed" } as { error?: string; pricing?: Pricing }));
    if (r.error || !r.pricing) { setState("error"); return; }
    setValue(r.pricing); setState("saved");
  }
  return (
    <details className="card" style={{ padding: 16, gap: 10 }}>
      <summary><strong>Prices</strong> <span className="small muted">({Object.values(initial.pieces).flat().length || "none yet"})</span></summary>
      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <PriceEditor pieces={pieces} allow={allow} value={value} onChange={(p) => { setValue(p); setState("idle"); }} />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button type="button" className="btn primary" disabled={state === "saving"} onClick={save}>{state === "saving" ? "Saving…" : "Save prices"}</button>
          {state === "saved" && <span className="small muted">Saved. The client sees them next time they look.</span>}
          {state === "error" && <span className="error">Couldn&apos;t save just now.</span>}
        </div>
      </div>
    </details>
  );
}
