"use client";

import {
  BAND_FINISHES, BANGLE_SIZES, CHAIN_STYLES, CUTS, GEMS, GEM_LOOK, KARATS, METALS, NECKLACE_LENGTHS, SETTINGS, SHAPES, SHOWCASE, SIDE_KINDS, STYLES, TYPES, TYPE_LABEL,
  type Design, type DesignPatch, type Gem, applyPatch, chooseStyle, estimateDims, indianRingSize, isGold, label, styleMeta,
} from "@/lib/design";

type Props = { design: Design; onChange: (patch: DesignPatch) => void; onReplace: (d: Design) => void };

const ENAMEL_SWATCHES = [["Meenakari green", "#16704c"], ["Ruby red", "#9b1630"], ["Peacock blue", "#1b3f8f"], ["Ivory", "#f3efe6"], ["Rani pink", "#d94f87"], ["Black", "#151515"]];
const FRINGE_GEMS: Gem[] = ["pearl", "coral", "emerald", "ruby", "onyx", "turquoise", "garnet", "amethyst"];
const gemLabel = (g: string) => (g === "cats-eye" ? "Cat's eye" : label(g));

function Chips<T extends string | number>({ options, value, onPick, name, fmt }: { options: readonly T[]; value: T; onPick: (v: T) => void; name: string; fmt?: (v: T) => string }) {
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

function Toggle({ id, checked, onChange, children }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label htmlFor={id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}

function GemSelect({ id, value, options, onPick }: { id: string; value: Gem; options: readonly Gem[]; onPick: (g: Gem) => void }) {
  return (
    <select id={id} value={value} onChange={(e) => onPick(e.target.value as Gem)}>
      {options.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
    </select>
  );
}

export default function DesignControls({ design: d, onChange, onReplace }: Props) {
  const c = d.center, o = d.options, meta = styleMeta(d.type, d.style);
  const has = (u: Parameters<typeof meta.uses.includes>[0]) => meta.uses.includes(u);
  const setCenter = (p: Partial<Design["center"]>) => onChange({ center: p });
  const setOpt = (p: Partial<Design["options"]>) => onChange({ options: p });
  const solidBracelet = d.type === "bracelet" && ["bangle", "kada", "cuff"].includes(d.style);
  const lengthName = (n: number) => NECKLACE_LENGTHS.reduce((a, b) => (Math.abs(b.in - n) < Math.abs(a.in - n) ? b : a)).name;

  function setCarat(v: string) {
    const ct = v === "" ? null : Number(v);
    if (ct && ct > 0) setCenter({ carat: ct, ...estimateDims(c.gem, c.cut, c.shape, ct) });
    else setCenter({ carat: null });
  }

  return (
    <>
      <section style={{ display: "grid", gap: 10 }}>
        <label className="field" htmlFor="showcase">
          <span>Start from</span>
          <select id="showcase" value="" onChange={(e) => {
            const s = SHOWCASE[Number(e.target.value)];
            if (s) onReplace({ ...(chooseStyleWith(d, s)), name: s.name });
          }}>
            <option value="">Choose a showcase piece…</option>
            {SHOWCASE.map((s, i) => <option key={s.name} value={i}>{s.name}</option>)}
          </select>
        </label>
        <label className="field" htmlFor="design-name">
          <span>Name</span>
          <input id="design-name" type="text" value={d.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h3>Piece</h3>
        <Chips name="Piece type" options={TYPES} value={d.type} fmt={(t) => TYPE_LABEL[t]} onPick={(t) => onReplace(chooseStyle(d, t))} />
        <Chips name="Style" options={Object.keys(STYLES[d.type])} value={d.style} fmt={(s) => STYLES[d.type][s].label} onPick={(s) => onReplace(chooseStyle(d, d.type, s))} />
        <p className="muted small" style={{ margin: 0 }}>{meta.blurb}</p>
      </section>

      {has("center") && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>{d.type === "ring" ? "Centre stone" : "Main stone"}</h3>
          <p className="muted small" style={{ margin: 0 }}>{c.label}</p>
          <div className="row2">
            <label className="field" htmlFor="gem"><span>Gem</span>
              <GemSelect id="gem" value={c.gem} options={GEMS} onPick={(gem) => setCenter({ gem, ...GEM_LOOK[gem], label: gemLabel(gem) })} />
            </label>
            <label className="field" htmlFor="carat"><span>Carat</span>
              <input id="carat" type="number" min={0.01} max={200} step={0.01} value={c.carat ?? ""} placeholder="e.g. 15.24" onChange={(e) => setCarat(e.target.value)} />
            </label>
          </div>
          <Chips name="Cut" options={CUTS} value={c.cut} onPick={(cut) => setCenter({ cut, ...(c.carat ? estimateDims(c.gem, cut, c.shape, c.carat) : { domeMm: Math.round(c.widthMm * (cut === "cabochon" ? 0.45 : cut === "rose-cut" ? 0.3 : cut === "polki" ? 0.07 : 0.14) * 10) / 10 }) })} />
          <Chips name="Shape" options={SHAPES} value={c.shape} onPick={(shape) => setCenter({ shape, ...(c.carat ? estimateDims(c.gem, c.cut, shape, c.carat) : {}) })} />
          <div className="row2">
            <Range id="len" label="Length" value={c.lengthMm} min={1} max={40} step={0.1} format={(n) => `${n} mm`} onChange={(lengthMm) => setCenter({ lengthMm })} />
            <Range id="wid" label="Width" value={c.widthMm} min={1} max={40} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => setCenter({ widthMm })} />
          </div>
          <div className="row2">
            <Range id="dome" label={c.cut === "cabochon" ? "Dome" : "Crown"} value={c.domeMm} min={0.2} max={12} step={0.1} format={(n) => `${n} mm`} onChange={(domeMm) => setCenter({ domeMm })} />
            <Range id="clar" label="Transparency" value={c.clarity} min={0} max={1} step={0.05} format={(n) => `${Math.round(n * 100)}%`} onChange={(clarity) => setCenter({ clarity })} />
          </div>
          <label className="field" htmlFor="color"><span>Colour</span>
            <input id="color" type="color" value={c.color} onChange={(e) => setCenter({ color: e.target.value })} style={{ width: "100%", height: 36, border: 0, background: "none" }} />
          </label>
        </section>
      )}

      {(has("accents") || (has("halo") && o.halo) || (has("pave") && o.pave)) && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Accent stones</h3>
          <div className="row2">
            <label className="field" htmlFor="acc-gem"><span>Gem</span>
              <GemSelect id="acc-gem" value={d.accents.gem} options={GEMS} onPick={(gem) => onChange({ accents: { gem, color: GEM_LOOK[gem].color } })} />
            </label>
            <label className="field" htmlFor="acc-color"><span>Colour</span>
              <input id="acc-color" type="color" value={d.accents.color} onChange={(e) => onChange({ accents: { color: e.target.value } })} style={{ width: "100%", height: 36, border: 0, background: "none" }} />
            </label>
          </div>
          <Chips name="Accent cut" options={["faceted", "polki", "rose-cut"] as const} value={d.accents.cut} onPick={(cut) => onChange({ accents: { cut } })} />
          <Range id="acc-ct" label="Each" value={d.accents.sizeCt} min={0.005} max={1} step={0.005} format={(n) => `${n.toFixed(3)} ct`} onChange={(sizeCt) => onChange({ accents: { sizeCt } })} />
        </section>
      )}

      {has("fringe") && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Fringe &amp; beads</h3>
          <Toggle id="fringe-on" checked={d.fringe.enabled} onChange={(enabled) => onChange({ fringe: { enabled } })}>Hanging beads</Toggle>
          {d.fringe.enabled && (
            <div className="row2">
              <label className="field" htmlFor="fringe-gem"><span>Bead</span>
                <GemSelect id="fringe-gem" value={d.fringe.gem} options={FRINGE_GEMS} onPick={(gem) => onChange({ fringe: { gem, color: GEM_LOOK[gem].color } })} />
              </label>
              <Range id="fringe-mm" label="Size" value={d.fringe.sizeMm} min={1.5} max={14} step={0.5} format={(n) => `${n} mm`} onChange={(sizeMm) => onChange({ fringe: { sizeMm } })} />
            </div>
          )}
        </section>
      )}

      {has("enamel") && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Meenakari enamel</h3>
          <Toggle id="enamel-on" checked={d.enamel.enabled} onChange={(enabled) => onChange({ enamel: { enabled } })}>Enamel work</Toggle>
          {d.enamel.enabled && (
            <div className="chips">
              {ENAMEL_SWATCHES.map(([n, hex]) => (
                <button key={hex} type="button" className="chip" aria-pressed={d.enamel.color === hex} style={{ textTransform: "none" }} onClick={() => onChange({ enamel: { color: hex } })}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: hex, marginRight: 6 }} />{n}
                </button>
              ))}
              <input id="enamel-color" type="color" value={d.enamel.color} onChange={(e) => onChange({ enamel: { color: e.target.value } })} style={{ width: 40, height: 30, border: 0, background: "none" }} />
            </div>
          )}
        </section>
      )}

      {(has("setting") || has("halo") || has("accentTop") || has("pave") || has("hoop") || has("length") || has("chain") || has("count") || has("layers") || has("wrist")) && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Construction</h3>
          {has("setting") && <Chips name="Setting" options={SETTINGS} value={d.setting.style} onPick={(style) => onChange({ setting: { style } })} />}
          {has("setting") && d.type === "ring" && (
            <Range id="height" label="Height" value={d.setting.height} min={0} max={1} step={0.05} format={(n) => (n < 0.2 ? "Low, seated in shank" : n < 0.6 ? "Medium" : "Tall cathedral")} onChange={(height) => onChange({ setting: { height } })} />
          )}
          {has("halo") && <Toggle id="halo" checked={o.halo} onChange={(halo) => setOpt({ halo })}>Halo of accent stones</Toggle>}
          {has("accentTop") && <Toggle id="acc-top" checked={o.accentTop} onChange={(accentTop) => setOpt({ accentTop })}>Accent stone at the top</Toggle>}
          {has("pave") && <Toggle id="pave" checked={o.pave} onChange={(pave) => setOpt({ pave })}>Pavé front</Toggle>}
          {has("hoop") && <Range id="hoop" label="Diameter" value={o.hoopDiameterMm} min={8} max={70} step={1} format={(n) => `${n} mm`} onChange={(hoopDiameterMm) => setOpt({ hoopDiameterMm })} />}
          {has("length") && <Range id="length" label="Length" value={o.lengthIn} min={12} max={40} step={1} format={(n) => `${n}" (${Math.round(n * 2.54)} cm) · ${lengthName(n)}`} onChange={(lengthIn) => setOpt({ lengthIn })} />}
          {has("chain") && <Chips name="Chain" options={CHAIN_STYLES} value={o.chain} onPick={(chain) => setOpt({ chain })} />}
          {has("count") && <Range id="count" label={d.style === "chandelier" ? "Tiers" : d.style === "tassel" ? "Strands" : d.style === "payal" ? "Bells" : "Stones"} value={o.count} min={1} max={d.style === "chandelier" ? 5 : 80} step={1} onChange={(count) => setOpt({ count })} />}
          {has("layers") && <Range id="layers" label="Rows / strands" value={o.layers} min={1} max={7} step={1} onChange={(layers) => setOpt({ layers })} />}
          {has("wrist") && (solidBracelet
            ? <><span className="small muted">Bangle size (Indian)</span><Chips name="Bangle size" options={BANGLE_SIZES} value={o.bangleSize} fmt={(s) => s} onPick={(bangleSize) => setOpt({ bangleSize })} /></>
            : <Range id="wrist" label="Wrist" value={o.wristCm} min={13} max={24} step={0.5} format={(n) => `${n} cm`} onChange={(wristCm) => setOpt({ wristCm })} />)}
        </section>
      )}

      {has("sides") && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Side stones</h3>
          <Chips name="Side stones" options={SIDE_KINDS} value={d.sides.kind} onPick={(kind) => onChange({ sides: { kind } })} />
          {d.sides.kind !== "none" && <Range id="side-ct" label="Each" value={d.sides.sizeCt} min={0.1} max={1.5} step={0.05} format={(n) => `${n.toFixed(2)} ct`} onChange={(sizeCt) => onChange({ sides: { sizeCt } })} />}
          <Toggle id="rose" checked={d.gallery.roseCut} onChange={(roseCut) => onChange({ gallery: { roseCut } })}>Rose-cut diamonds on the gallery</Toggle>
        </section>
      )}

      {has("band") && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Band</h3>
          <Chips name="Band finish" options={BAND_FINISHES} value={d.band.finish} onPick={(finish) => onChange({ band: { finish } })} />
          <div className="row2">
            <Range id="bw" label="Width" value={d.band.widthMm} min={1.5} max={8} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => onChange({ band: { widthMm } })} />
            <Range id="size" label="Size" value={d.ringSize} min={3} max={13} step={0.25} format={(n) => `US ${n} · Indian ${indianRingSize(n)}`} onChange={(ringSize) => onChange({ ringSize })} />
          </div>
        </section>
      )}

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Metal</h3>
        <Chips name="Metal" options={METALS} value={d.metal} onPick={(metal) => onChange({ metal })} />
        {isGold(d.metal) && (
          <>
            <Chips name="Purity" options={KARATS} value={d.purity.karat as (typeof KARATS)[number]} fmt={(k) => `${k}k`} onPick={(karat) => onChange({ purity: { karat } })} />
            <div className="row2" style={{ alignItems: "end" }}>
              <Toggle id="bis" checked={d.purity.bisHallmark} onChange={(bisHallmark) => onChange({ purity: { bisHallmark } })}>BIS hallmark</Toggle>
              <label className="field" htmlFor="huid"><span>HUID</span>
                <input id="huid" type="text" maxLength={6} value={d.purity.huid} placeholder="6 characters" onChange={(e) => onChange({ purity: { huid: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") } })} />
              </label>
            </div>
          </>
        )}
      </section>
    </>
  );
}

/** apply a showcase entry: switch type/style (with its defaults), then its own patch */
function chooseStyleWith(d: Design, s: (typeof SHOWCASE)[number]): Design {
  return applyPatch(chooseStyle(d, s.type, s.style), s.patch);
}
