"use client";

import {
  BAND_FINISHES, CUTS, GEMS, METALS, SETTINGS, SHAPES, SIDE_KINDS,
  type Design, type DesignPatch, estimateDims, label,
} from "@/lib/design";

type Props = { design: Design; onChange: (patch: DesignPatch) => void };

function Chips<T extends string>({ options, value, onPick, name }: { options: readonly T[]; value: T; onPick: (v: T) => void; name: string }) {
  return (
    <div className="chips" role="group" aria-label={name}>
      {options.map((o) => (
        <button key={o} type="button" className="chip" aria-pressed={o === value} onClick={() => onPick(o)}>
          {label(o)}
        </button>
      ))}
    </div>
  );
}

function Range({ id, label: text, value, min, max, step, onChange, format }: {
  id: string; label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void; format?: (n: number) => string;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span>{text} · <b style={{ fontWeight: 400, color: "var(--fg)" }}>{format ? format(value) : value}</b></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

export default function DesignControls({ design: d, onChange }: Props) {
  const c = d.center;
  const setCenter = (p: Partial<Design["center"]>) => onChange({ center: p });

  function setCarat(v: string) {
    const ct = v === "" ? null : Number(v);
    if (ct && ct > 0) setCenter({ carat: ct, ...estimateDims(c.gem, c.cut, c.shape, ct) });
    else setCenter({ carat: null });
  }

  return (
    <>
      <section className="field">
        <span>Name</span>
        <input id="design-name" type="text" value={d.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value })} />
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Centre stone</h3>
        <p className="muted small" style={{ margin: 0 }}>{c.label}</p>
        <Chips name="Gem" options={GEMS} value={c.gem} onPick={(gem) => setCenter({ gem })} />
        <Chips name="Cut" options={CUTS} value={c.cut} onPick={(cut) => setCenter({ cut, ...(c.carat ? estimateDims(c.gem, cut, c.shape, c.carat) : { domeMm: Math.round(c.widthMm * (cut === "cabochon" ? 0.45 : 0.14) * 10) / 10 }) })} />
        <Chips name="Shape" options={SHAPES} value={c.shape} onPick={(shape) => setCenter({ shape, ...(c.carat ? estimateDims(c.gem, c.cut, shape, c.carat) : {}) })} />
        <div className="row2">
          <label className="field" htmlFor="carat">
            <span>Carat</span>
            <input id="carat" type="number" min={0.1} max={60} step={0.01} value={c.carat ?? ""} placeholder="e.g. 15.24" onChange={(e) => setCarat(e.target.value)} />
          </label>
          <label className="field" htmlFor="color">
            <span>Colour</span>
            <input id="color" type="color" value={c.color} onChange={(e) => setCenter({ color: e.target.value })} style={{ width: "100%", height: 40, border: 0, background: "none" }} />
          </label>
        </div>
        <div className="row2">
          <Range id="len" label="Length" value={c.lengthMm} min={3} max={30} step={0.1} format={(n) => `${n} mm`} onChange={(lengthMm) => setCenter({ lengthMm })} />
          <Range id="wid" label="Width" value={c.widthMm} min={3} max={30} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => setCenter({ widthMm })} />
        </div>
        <div className="row2">
          <Range id="dome" label={c.cut === "cabochon" ? "Dome" : "Crown"} value={c.domeMm} min={0.5} max={12} step={0.1} format={(n) => `${n} mm`} onChange={(domeMm) => setCenter({ domeMm })} />
          <Range id="clar" label="Transparency" value={c.clarity} min={0} max={1} step={0.05} format={(n) => `${Math.round(n * 100)}%`} onChange={(clarity) => setCenter({ clarity })} />
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Side stones</h3>
        <Chips name="Side stones" options={SIDE_KINDS} value={d.sides.kind} onPick={(kind) => onChange({ sides: { kind } })} />
        {d.sides.kind !== "none" && (
          <Range id="side-ct" label="Each" value={d.sides.sizeCt} min={0.1} max={1.5} step={0.05} format={(n) => `${n.toFixed(2)} ct`} onChange={(sizeCt) => onChange({ sides: { sizeCt } })} />
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Setting</h3>
        <Chips name="Setting" options={SETTINGS} value={d.setting.style} onPick={(style) => onChange({ setting: { style } })} />
        <Range id="height" label="Height" value={d.setting.height} min={0} max={1} step={0.05}
          format={(n) => (n < 0.2 ? "Low, seated in shank" : n < 0.6 ? "Medium" : "Tall cathedral")} onChange={(height) => onChange({ setting: { height } })} />
        <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input id="rose" type="checkbox" checked={d.gallery.roseCut} onChange={(e) => onChange({ gallery: { roseCut: e.target.checked } })} />
          Rose-cut diamonds on the gallery
        </label>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Metal &amp; band</h3>
        <Chips name="Metal" options={METALS} value={d.metal} onPick={(metal) => onChange({ metal })} />
        <Chips name="Band finish" options={BAND_FINISHES} value={d.band.finish} onPick={(finish) => onChange({ band: { finish } })} />
        <div className="row2">
          <Range id="bw" label="Band width" value={d.band.widthMm} min={1.5} max={6} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => onChange({ band: { widthMm } })} />
          <Range id="size" label="US size" value={d.ringSize} min={3} max={13} step={0.25} onChange={(ringSize) => onChange({ ringSize })} />
        </div>
      </section>
    </>
  );
}
