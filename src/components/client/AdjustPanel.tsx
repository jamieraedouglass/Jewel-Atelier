"use client";

import { BANGLE_SIZES, applyPatch, indianRingSize, isGold, isSolidBracelet, label, lengthForShape, metalName, type Design, type DesignPatch } from "@/lib/design";
import { describeChanges, optionLook, optionName, sizeText, type Allow, type StoneOption } from "@/lib/studio/links";
import { Chips, Range } from "../controls/fields";

type Props = { base: Design; design: Design; allow: Allow; onChange: (d: Design) => void };

/** The adjustments the jeweller allowed on this piece, in plain words. */
export default function AdjustPanel({ base, design: d, allow, onChange }: Props) {
  const set = (p: DesignPatch) => onChange(applyPatch(d, p));
  const c = d.center, b = base.center;
  const stoneChoices: { key: string; label: string; color: string; pick: () => void }[] = [
    { key: "own", label: b.label || label(b.gem), color: b.color, pick: () => set({ center: { gem: b.gem, color: b.color, clarity: b.clarity, glow: b.glow, label: b.label } }) },
    // the piece's own stone is listed once, even when it is also one of the options
    ...allow.stones.filter((o) => !(o.gem === b.gem && optionLook(o).color.toLowerCase() === b.color.toLowerCase())).map((o: StoneOption) => {
      const look = optionLook(o);
      return { key: `${o.gem}-${o.grade ?? ""}`, label: optionName(o), color: look.color, pick: () => set({ center: { gem: o.gem, color: look.color, clarity: look.clarity, glow: look.glow, label: look.label } }) };
    }),
  ];
  const currentStone = stoneChoices.find((s) => s.color.toLowerCase() === c.color.toLowerCase())?.key ?? "own";
  const shapes = [b.shape, ...allow.shapes.filter((s) => s !== b.shape)];
  const scale = Math.round((c.widthMm / b.widthMm - 1) * 100);
  const r = Math.round(allow.stoneScale * 100);
  const metals = [base.metal, ...allow.metals.filter((m) => m !== base.metal)];
  const karats = [base.purity.karat, ...allow.karats.filter((k) => k !== base.purity.karat)].sort((x, y) => x - y);
  const changes = describeChanges(base, d);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {allow.sizes && (
        <section style={{ display: "grid", gap: 10 }}>
          <h3>Size</h3>
          {d.type === "ring" && <Range id="c-ring" label="Ring size" value={d.ringSize} min={3} max={13} step={0.25} format={(n) => `US ${n} · Indian ${indianRingSize(n)}`} onChange={(ringSize) => set({ ringSize })} />}
          {d.type === "bracelet" && (isSolidBracelet(d)
            ? <Chips name="Bangle size" options={BANGLE_SIZES} value={d.options.bangleSize} fmt={(s) => s} onPick={(bangleSize) => set({ options: { bangleSize } })} />
            : <Range id="c-wrist" label="Wrist" value={d.options.wristCm} min={13} max={24} step={0.5} format={(n) => `${n} cm`} onChange={(wristCm) => set({ options: { wristCm } })} />)}
          {d.type === "necklace" && <Range id="c-len" label="Length" value={d.options.lengthIn} min={14} max={36} step={1} format={(n) => `${n}" (${Math.round(n * 2.54)} cm)`} onChange={(lengthIn) => set({ options: { lengthIn } })} />}
          {d.type !== "ring" && d.type !== "bracelet" && d.type !== "necklace" && <p className="small muted" style={{ margin: 0 }}>This piece is one size; the jeweller will fit it for you.</p>}
        </section>
      )}

      {!b.none && (allow.stones.length > 0 || allow.shapes.length > 0 || allow.stoneScale > 0) && (
        <section style={{ display: "grid", gap: 10 }}>
          <h3>The stone</h3>
          {allow.stones.length > 0 && (
            <div className="chips" role="group" aria-label="Centre stone">
              {stoneChoices.map((s) => (
                <button key={s.key} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={currentStone === s.key} onClick={s.pick}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: s.color, marginRight: 6, border: "1px solid var(--line)" }} />{s.label}
                </button>
              ))}
            </div>
          )}
          {allow.shapes.length > 0 && (
            <Chips name="Shape" options={shapes} value={c.shape} fmt={label} onPick={(shape) => set({ center: { shape, lengthMm: shape === b.shape ? c.widthMm * (b.lengthMm / b.widthMm) : lengthForShape(c.widthMm, shape) } })} />
          )}
          {allow.stoneScale > 0 && (
            <Range id="c-scale" label="Stone size" value={scale} min={-r} max={r} step={1}
              format={(n) => (n === 0 ? `As designed (${sizeText(b)} mm)` : `${n > 0 ? "+" : ""}${n}% · ${sizeText(c)} mm`)}
              onChange={(pct) => { const k = 1 + pct / 100; const L = c.shape === b.shape ? b.lengthMm * k : lengthForShape(b.widthMm * k, c.shape); set({ center: { widthMm: Math.round(b.widthMm * k * 10) / 10, lengthMm: Math.round(L * 10) / 10 } }); }} />
          )}
        </section>
      )}

      {(allow.metals.length > 0 || allow.karats.length > 0) && (
        <section style={{ display: "grid", gap: 10 }}>
          <h3>Metal</h3>
          {allow.metals.length > 0 && <Chips name="Metal" options={metals} value={d.metal} fmt={label} onPick={(metal) => set({ metal })} />}
          {allow.karats.length > 0 && isGold(d.metal) && <Chips name="Karat" options={karats as readonly number[]} value={d.purity.karat} fmt={(k) => `${k}k`} onPick={(karat) => set({ purity: { karat: karat as 14 | 18 | 22 | 24 } })} />}
        </section>
      )}

      <section style={{ display: "grid", gap: 8 }}>
        <h3>Your changes</h3>
        {changes.length ? <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{changes.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="small muted" style={{ margin: 0 }}>None yet: this is the piece as the jeweller designed it.</p>}
        {changes.length > 0 && <div><button type="button" className="btn" onClick={() => onChange(base)}>Back to the jeweller&apos;s original</button></div>}
        <p className="small muted" style={{ margin: 0 }}>{metalName(d)}. Your changes are saved for the jeweller to see.</p>
      </section>
    </div>
  );
}
