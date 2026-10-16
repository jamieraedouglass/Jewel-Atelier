"use client";

import { GEMS, GEM_LOOK, KARATS, METALS, SHAPES, gemLabel, indianRingSize, isGold, label } from "@/lib/design";
import {
  AESTHETICS, AESTHETIC_LABEL, CURRENCIES, DESIGNING_FOR, OCCASIONS, SCALES, UNDERTONES, type StylePrefs,
} from "@/lib/style/profile";
import { Chips } from "../controls/fields";
import MultiChips from "./MultiChips";

type Props = { prefs: StylePrefs; onChange: (p: StylePrefs) => void };
const sec = { display: "grid", gap: 10 } as const;

/** a single choice that can be cleared by tapping it again */
function OneOf<T extends string>({ name, options, value, fmt, onPick }: { name: string; options: readonly T[]; value: T | null; fmt: (v: T) => string; onPick: (v: T | null) => void }) {
  return <Chips name={name} options={options} value={value as T} fmt={fmt} onPick={(v) => onPick(v === value ? null : v)} />;
}

const num = (v: string) => (v.trim() === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/** the structured part of the profile: who it's for, style, metals, gems, shapes, scale, occasions, budget and sizes */
export default function PrefsSections({ prefs: p, onChange }: Props) {
  const set = (x: Partial<StylePrefs>) => onChange({ ...p, ...x });
  return (
    <>
      <section style={sec}>
        <h3>Who you&apos;re designing for</h3>
        <OneOf name="Designing for" options={DESIGNING_FOR} value={p.designingFor}
          fmt={(v) => (v === "myself" ? "Myself" : v === "clients" ? "My clients (I'm a jeweller)" : "A gift")} onPick={(designingFor) => set({ designingFor })} />
      </section>

      <section style={sec}>
        <h3>Your style <span className="muted small">(up to 6)</span></h3>
        <MultiChips name="Style" options={AESTHETICS} value={p.aesthetics} max={6} fmt={(a) => AESTHETIC_LABEL[a]} onChange={(aesthetics) => set({ aesthetics })} />
        <span className="small muted">Scale</span>
        <OneOf name="Scale" options={SCALES} value={p.scale} fmt={(v) => (v === "delicate" ? "Delicate" : v === "balanced" ? "Balanced" : "Statement")} onPick={(scale) => set({ scale })} />
        <span className="small muted">Mostly for</span>
        <MultiChips name="Occasions" options={OCCASIONS} value={p.occasions} fmt={label} onChange={(occasions) => set({ occasions })} />
      </section>

      <section style={sec}>
        <h3>Metals</h3>
        <MultiChips name="Metals" options={METALS} value={p.metals} fmt={label} onChange={(metals) => set({ metals })} />
        {p.metals.some(isGold) && (
          <OneOf name="Karat" options={KARATS.map(String) as readonly string[]} value={p.karat ? String(p.karat) : null} fmt={(k) => `${k}k`} onPick={(k) => set({ karat: k ? Number(k) : null })} />
        )}
        <span className="small muted">Skin undertone (optional: guides which metals flatter)</span>
        <OneOf name="Undertone" options={UNDERTONES} value={p.undertone} fmt={label} onPick={(undertone) => set({ undertone })} />
      </section>

      <section style={sec}>
        <h3>Gems</h3>
        <span className="small muted">Love</span>
        <MultiChips name="Gems you love" options={GEMS} value={p.loveGems} max={10} fmt={gemLabel} swatch={(g) => GEM_LOOK[g].color}
          onChange={(loveGems) => set({ loveGems, avoidGems: p.avoidGems.filter((g) => !loveGems.includes(g)) })} />
        <span className="small muted">Avoid</span>
        <MultiChips name="Gems to avoid" options={GEMS} value={p.avoidGems} max={10} fmt={gemLabel}
          onChange={(avoidGems) => set({ avoidGems, loveGems: p.loveGems.filter((g) => !avoidGems.includes(g)) })} />
        <span className="small muted">Favourite shapes</span>
        <MultiChips name="Favourite shapes" options={SHAPES} value={p.shapes} max={8} fmt={label} onChange={(shapes) => set({ shapes })} />
      </section>

      <section style={sec}>
        <h3>Budget and sizes <span className="muted small">(optional)</span></h3>
        <div className="row2">
          <label className="field" htmlFor="budget"><span>Budget for a piece</span>
            <input id="budget" type="number" min={0} step={1000} value={p.budget.amount ?? ""} placeholder="e.g. 300000"
              onChange={(e) => set({ budget: { ...p.budget, amount: num(e.target.value) && num(e.target.value)! > 0 ? num(e.target.value) : null } })} />
          </label>
          <label className="field" htmlFor="currency"><span>Currency</span>
            <select id="currency" value={p.budget.currency} onChange={(e) => set({ budget: { ...p.budget, currency: e.target.value as StylePrefs["budget"]["currency"] } })}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <div className="row2">
          <label className="field" htmlFor="ring-us"><span>Ring size (US){p.sizes.ringUs ? ` · Indian ${indianRingSize(p.sizes.ringUs)}` : ""}</span>
            <input id="ring-us" type="number" min={3} max={13} step={0.25} value={p.sizes.ringUs ?? ""} onChange={(e) => set({ sizes: { ...p.sizes, ringUs: num(e.target.value) } })} />
          </label>
          <label className="field" htmlFor="wrist"><span>Wrist (cm)</span>
            <input id="wrist" type="number" min={13} max={24} step={0.5} value={p.sizes.wristCm ?? ""} onChange={(e) => set({ sizes: { ...p.sizes, wristCm: num(e.target.value) } })} />
          </label>
        </div>
        <label className="field" htmlFor="neck"><span>Necklace length (inches)</span>
          <input id="neck" type="number" min={12} max={40} step={1} value={p.sizes.necklaceIn ?? ""} onChange={(e) => set({ sizes: { ...p.sizes, necklaceIn: num(e.target.value) } })} />
        </label>
      </section>

      <section style={sec}>
        <h3>Never suggest</h3>
        <textarea id="avoid" value={p.avoid} maxLength={800} onChange={(e) => set({ avoid: e.target.value })}
          placeholder="Big halos, heavy pieces for everyday, anything too matchy…" />
      </section>
    </>
  );
}
