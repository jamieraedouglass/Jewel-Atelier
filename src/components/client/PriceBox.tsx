"use client";

import type { Design } from "@/lib/design";
import { applyVersion, priceFor, priceText, versionName, type Currency, type PriceVersion } from "@/lib/studio/pricing";

export default function PriceBox({ base, design, versions, currency, rate, studioName, onPick }: {
  base: Design; design: Design; versions: PriceVersion[] | undefined; currency: Currency; rate: number | null; studioName: string;
  onPick: (d: Design) => void;
}) {
  if (!versions?.length) return null;
  const match = priceFor(base, design, versions);
  const shown = match ? priceText(match.inr, currency, rate) : null;
  return (
    <section className="price-box" aria-live="polite">
      <h3>Price</h3>
      {shown ? (
        <>
          <b className="price">{shown.main}</b>
          {shown.sub && <span className="small muted">{shown.sub}</span>}
          <span className="small muted">From {studioName}, for the piece exactly as it is now. Confirmed when you order.</span>
        </>
      ) : (
        <>
          <b className="price" style={{ fontSize: 20 }}>On request</b>
          <span className="small muted">Your changes need a new price from {studioName}: use Ask the jeweller{versions.length ? ", or pick one of the priced versions below" : ""}.</span>
        </>
      )}
      {versions.length > (match ? 1 : 0) && (
        <div className="chips" role="group" aria-label="Priced versions">
          {versions.map((v, i) => (
            <button key={i} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={v === match} onClick={() => onPick(applyVersion(base, design, v))}>
              {versionName(base, v)} · {priceText(v.inr, currency, rate).main}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
