"use client";

import { label } from "@/lib/design";
import { optionName, type Allow, type StoneOption } from "@/lib/studio/links";
import { CURRENCIES, CURRENCY_NAMES, formatMoney, type Currency, type PriceVersion, type Pricing } from "@/lib/studio/pricing";

type Piece = { id: string; name: string };
const stoneKey = (o?: StoneOption) => (o ? `${o.gem}:${o.grade ?? ""}` : "");

export default function PriceEditor({ pieces, allow, value, onChange }: { pieces: Piece[]; allow: Allow; value: Pricing; onChange: (p: Pricing) => void }) {
  const setPiece = (id: string, versions: PriceVersion[]) => onChange({ ...value, pieces: { ...value.pieces, [id]: versions } });
  const draft = (id: string) => value.pieces[id] ?? [];
  const choices = allow.stones.length + allow.shapes.length + allow.metals.length + allow.karats.length > 0;

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <p className="small muted" style={{ margin: 0 }}>
        Optional. Enter prices in rupees. The client sees a price only while their piece is exactly that version: if they change anything else it disappears
        (sizes don&apos;t count). They can tap a priced version to go back to it.
      </p>
      <label className="field" style={{ maxWidth: 320 }}><span>The client sees prices in</span>
        <select value={value.currency} onChange={(e) => onChange({ ...value, currency: e.target.value as Currency })}>
          {CURRENCIES.map((c) => <option key={c} value={c}>{CURRENCY_NAMES[c]}{c !== "INR" ? ", converted from rupees at today's rate" : ""}</option>)}
        </select>
      </label>
      {pieces.map((p) => (
        <div key={p.id} style={{ display: "grid", gap: 8 }}>
          <strong className="small">{p.name}</strong>
          {draft(p.id).map((v, i) => {
            const set = (patch: Partial<PriceVersion>) => setPiece(p.id, draft(p.id).map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }}>
                {allow.stones.length > 0 && (
                  <label className="field"><span>Stone</span>
                    <select value={stoneKey(v.stone)} onChange={(e) => set({ stone: allow.stones.find((o) => stoneKey(o) === e.target.value) })}>
                      <option value="">As designed</option>
                      {allow.stones.map((o) => <option key={stoneKey(o)} value={stoneKey(o)}>{optionName(o)}</option>)}
                    </select>
                  </label>
                )}
                {allow.shapes.length > 0 && (
                  <label className="field"><span>Shape</span>
                    <select value={v.shape ?? ""} onChange={(e) => set({ shape: (e.target.value || undefined) as PriceVersion["shape"] })}>
                      <option value="">As designed</option>
                      {allow.shapes.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  </label>
                )}
                {allow.metals.length > 0 && (
                  <label className="field"><span>Metal</span>
                    <select value={v.metal ?? ""} onChange={(e) => set({ metal: (e.target.value || undefined) as PriceVersion["metal"] })}>
                      <option value="">As designed</option>
                      {allow.metals.map((m) => <option key={m} value={m}>{label(m)}</option>)}
                    </select>
                  </label>
                )}
                {allow.karats.length > 0 && (
                  <label className="field"><span>Karat</span>
                    <select value={v.karat ?? ""} onChange={(e) => set({ karat: e.target.value ? Number(e.target.value) : undefined })}>
                      <option value="">As designed</option>
                      {allow.karats.map((k) => <option key={k} value={k}>{k}k</option>)}
                    </select>
                  </label>
                )}
                <label className="field"><span>Price (₹)</span>
                  <input type="number" inputMode="numeric" min={1} step={1000} value={v.inr || ""} placeholder="185000" style={{ width: 140 }}
                    onChange={(e) => set({ inr: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
                </label>
                <span className="small muted" style={{ paddingBottom: 10 }}>{v.inr > 0 ? formatMoney(v.inr, "INR") : ""}</span>
                <button type="button" className="chip" aria-label="Remove this price" onClick={() => setPiece(p.id, draft(p.id).filter((_, j) => j !== i))}>×</button>
              </div>
            );
          })}
          <div>
            <button type="button" className="chip" style={{ textTransform: "none" }} onClick={() => setPiece(p.id, [...draft(p.id), { inr: 0 }])}>
              + {draft(p.id).length ? (choices ? "Price another version" : "Add a price") : "Add a price"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export const filledPricing = (p: Pricing): Pricing => ({
  currency: p.currency,
  pieces: Object.fromEntries(Object.entries(p.pieces).map(([id, vs]) => [id, vs.filter((v) => v.inr > 0)]).filter(([, vs]) => (vs as PriceVersion[]).length)),
});
