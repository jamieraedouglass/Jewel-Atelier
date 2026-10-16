"use client";

import { type Design, type DesignPatch, type Gem, gemLabel, label } from "@/lib/design";

/** what every controls section receives */
export type SectionProps = { d: Design; onChange: (patch: DesignPatch) => void };

/** a row of toggle buttons, one pressed */
export function Chips<T extends string | number>({ options, value, onPick, name, fmt }: { options: readonly T[]; value: T; onPick: (v: T) => void; name: string; fmt?: (v: T) => string }) {
  return (
    <div className="chips" role="group" aria-label={name}>
      {options.map((o) => (
        <button key={String(o)} type="button" className="chip" aria-pressed={o === value} onClick={() => onPick(o)}>
          {fmt ? fmt(o) : label(String(o))}
        </button>
      ))}
    </div>
  );
}

export function Range({ id, label: text, value, min, max, step, onChange, format }: {
  id: string; label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; format?: (n: number) => string;
}) {
  // sliders step in binary floating point (0.1 × 42 = 4.199999…): show and send the value to the step's precision
  const places = Math.max(0, Math.min(4, Math.ceil(-Math.log10(step) + 1e-9)));
  const tidy = (n: number) => Number(n.toFixed(places));
  value = tidy(value);
  return (
    <label className="field" htmlFor={id}>
      <span>{text} · <b style={{ fontWeight: 400, color: "var(--fg)" }}>{format ? format(value) : value}</b></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(tidy(Number(e.target.value)))} />
    </label>
  );
}

export function Toggle({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

export function GemSelect({ id, value, options, onPick }: { id: string; value: Gem; options: readonly Gem[]; onPick: (g: Gem) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onPick(e.target.value as Gem)}>
      {options.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
    </select>
  );
}

export const colorInputStyle = { width: "100%", height: 36, border: 0, background: "none" } as const;
export const sectionStyle = { display: "grid", gap: 12 } as const;

/** a slider showing its value and unit */
export function Num({ id, text, value, min, max, step, unit = "mm", onChange }: { id: string; text: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (n: number) => void }) {
  return <Range id={id} label={text} value={value} min={min} max={max} step={step} format={(n) => `${n}${unit && ` ${unit}`}`} onChange={onChange} />;
}

/** a labelled drop-down */
export function Pick<T extends string>({ id, text, value, options, fmt, onPick }: { id: string; text: string; value: T; options: readonly T[]; fmt?: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <label className="field" htmlFor={id}><span>{text}</span>
      <select id={id} value={value} onChange={(e) => onPick(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{fmt ? fmt(o) : label(o)}</option>)}
      </select>
    </label>
  );
}

/** plain-words direction presets for pears, hearts, marquises and briolettes */
export function Dir({ value, options, onPick }: { value: number; options: [number, string][]; onPick: (deg: number) => void }) {
  return (
    <div className="chips" role="group" aria-label="Which way the stones point">
      {options.map(([deg, text]) => <button key={deg} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={value === deg} onClick={() => onPick(deg)}>{text}</button>)}
    </div>
  );
}

/** a checkbox with its label beside it (no id needed) */
export function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

/**
 * <option>s for a list of named entries, grouped by their collection (Kothari's signatures, …); entries without one
 * come first. Each option's value is the entry's index in the original list.
 */
export function GroupedOptions<T extends { name: string; collection?: string }>({ items, text = (x) => x.name }: { items: readonly T[]; text?: (x: T) => string }) {
  const groups = new Map<string, { item: T; i: number }[]>();
  items.forEach((item, i) => { const k = item.collection ?? ""; groups.set(k, [...(groups.get(k) ?? []), { item, i }]); });
  const opts = (list: { item: T; i: number }[]) => list.map(({ item, i }) => <option key={item.name} value={i}>{text(item)}</option>);
  return (
    <>
      {opts(groups.get("") ?? [])}
      {[...groups].filter(([k]) => k).map(([k, list]) => <optgroup key={k} label={k}>{opts(list)}</optgroup>)}
    </>
  );
}
