"use client";

import MotifPanel from "./MotifPanel";
import DropComposer from "./DropComposer";
import ShapeOrder from "./ShapeOrder";
import FramesEditor from "./FramesEditor";
import {
  BAND_FINISHES, BANGLE_SIZES, BEAD_GEMS, CHAIN_STYLES, CUTS, GEMS, GEM_LOOK, KARATS, METALS, NECKLACE_LENGTHS, SETTINGS, SHAPES, SHOWCASE, SIDE_KINDS, STYLES, TYPES, TYPE_LABEL,
  SHAPE_RATIO, type Design, type DesignPatch, type ExtraStone, type Gem, applyPatch, chooseStyle, estimateDims, indianRingSize, isGold, label, styleMeta,
} from "@/lib/design";

type Props = { design: Design; userId: string | null; onChange: (patch: DesignPatch) => void; onReplace: (d: Design) => void; dropFocus?: number | null };

const ENAMEL_SWATCHES = [["Meenakari green", "#16704c"], ["Ruby red", "#9b1630"], ["Peacock blue", "#1b3f8f"], ["Ivory", "#f3efe6"], ["Rani pink", "#d94f87"], ["Black", "#151515"]];
/** colour runs for multi-colour lines, e.g. a rainbow sapphire tennis bracelet */
const RAINBOW = ["#d8371f", "#ee6a1c", "#f2a81c", "#efd21f", "#9cc63a", "#2e9e54", "#1f8a9a", "#2456b8", "#4433a6", "#7a3fa6", "#c23c8f", "#e2558a"];
const COLOR_PRESETS: [string, string[]][] = [
  ["Rainbow", RAINBOW],
  ["Rainbow, there and back", [...RAINBOW, ...RAINBOW.slice(1, -1).reverse()]],
  ["Pink ombré", ["#fbd3df", "#f6a9c0", "#ee7ea2", "#e2558a", "#c23c74", "#e2558a", "#ee7ea2", "#f6a9c0"]],
  ["Blue ombré", ["#cfe2f7", "#9cc2ec", "#5f93d8", "#2f62bd", "#1c3f94", "#2f62bd", "#5f93d8", "#9cc2ec"]],
  ["Ruby & diamond", ["#b3062a", "#f4f6fb"]],
  ["Emerald & diamond", ["#0b7a4b", "#f4f6fb"]],
  ["Sapphire & diamond", ["#0c2394", "#f4f6fb"]],
];
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

export default function DesignControls({ design: d, userId, onChange, onReplace, dropFocus }: Props) {
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

      {has("motif") && <MotifPanel design={d} userId={userId} onChange={onChange} />}

      {has("frames") && <FramesEditor design={d} onChange={onChange} />}

      {has("drop") && <DropComposer design={d} onChange={onChange} focusIndex={dropFocus} />}

      {has("center") && (
        <section id="sec-center" style={{ display: "grid", gap: 12 }}>
          <h3>{d.type === "ring" ? "Centre stone" : "Main stone"}</h3>
          <Toggle id="no-main" checked={c.none} onChange={(none) => setCenter({ none })}>
            {d.type === "ring" ? "No centre stone (plain band)" : d.style === "hoop" ? "No charm (plain hoops)" : "No main stone"}
          </Toggle>
          {!c.none && (<>
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
          <div className="row2">
            <label className="field" htmlFor="color"><span>Colour</span>
              <input id="color" type="color" value={c.color} onChange={(e) => setCenter({ color: e.target.value })} style={{ width: "100%", height: 36, border: 0, background: "none" }} />
            </label>
            <Range id="angle" label="Angle" value={c.rotation} min={-180} max={180} step={5} format={(n) => `${n}°`} onChange={(rotation) => setCenter({ rotation })} />
          </div>
          </>)}
        </section>
      )}

      {has("extraStones") && (
        <section id="sec-extra" style={{ display: "grid", gap: 12 }}>
          <h3>{d.type === "ring" ? "Second stone" : "More stones in each stud"}</h3>
          <p className="muted small" style={{ margin: 0 }}>{d.type === "ring"
            ? "Sits beside the main stone. Give it its own gem, cut, shape, size and angle, and nudge it into place."
            : "Each extra stone sits below the one before it. Give each its own gem, cut, shape, size and angle, and nudge it into place."}</p>
          {d.extraStones.map((e, i) => {
            const set = (p: Partial<ExtraStone>) => onChange({ extraStones: d.extraStones.map((x, j) => (j === i ? { ...x, ...p } : x)) } as DesignPatch);
            return (
              <div key={i} style={{ display: "grid", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>Stone {i + 2}</strong>
                  <button type="button" className="chip" onClick={() => onChange({ extraStones: d.extraStones.filter((_, j) => j !== i) } as DesignPatch)}>Remove</button>
                </div>
                <div className="row2">
                  <label className="field" htmlFor={`x-gem-${i}`}><span>Gem</span>
                    <GemSelect id={`x-gem-${i}`} value={e.gem} options={GEMS} onPick={(gem) => set({ gem, ...GEM_LOOK[gem] })} />
                  </label>
                  <label className="field" htmlFor={`x-shape-${i}`}><span>Shape</span>
                    <select id={`x-shape-${i}`} value={e.shape} onChange={(ev) => { const shape = ev.target.value as ExtraStone["shape"]; set({ shape, lengthMm: Math.round(e.widthMm * SHAPE_RATIO[shape] * 10) / 10 }); }}>
                      {SHAPES.map((sh) => <option key={sh} value={sh}>{label(sh)}</option>)}
                    </select>
                  </label>
                </div>
                <Chips name="Cut" options={CUTS} value={e.cut} onPick={(cut) => set({ cut })} />
                <div className="row2">
                  <Range id={`x-l-${i}`} label="Length" value={e.lengthMm} min={1} max={30} step={0.1} format={(n) => `${n} mm`} onChange={(lengthMm) => set({ lengthMm })} />
                  <Range id={`x-w-${i}`} label="Width" value={e.widthMm} min={1} max={30} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => set({ widthMm })} />
                </div>
                <Range id={`x-a-${i}`} label="Angle" value={e.rotation} min={-180} max={180} step={5} format={(n) => `${n}°`} onChange={(rotation) => set({ rotation })} />
                <div className="row2">
                  <Range id={`x-dx-${i}`} label="Shift sideways" value={e.dx} min={-15} max={15} step={0.25} format={(n) => `${n} mm`} onChange={(dx) => set({ dx })} />
                  <Range id={`x-dz-${i}`} label="Shift down" value={e.dz} min={-15} max={15} step={0.25} format={(n) => `${n} mm`} onChange={(dz) => set({ dz })} />
                </div>
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn" disabled={d.extraStones.length >= (d.type === "ring" ? 1 : 6)}
              onClick={() => onChange({ extraStones: [...d.extraStones, { gem: "diamond", cut: "faceted", shape: "pear", lengthMm: 7, widthMm: 5, domeMm: 0.8, color: GEM_LOOK.diamond.color, clarity: 0.95, rotation: 0, dx: 0, dz: 0 }] } as DesignPatch)}>
              + Add a stone
            </button>
            <button type="button" className="btn"
              onClick={() => onChange({ center: { shape: "pear", cut: "faceted", gem: "diamond", lengthMm: 8, widthMm: 5.5, domeMm: 0.8, rotation: 35, color: GEM_LOOK.diamond.color, clarity: 0.95 }, extraStones: [{ gem: "emerald", cut: "faceted", shape: "emerald", lengthMm: 7, widthMm: 5, domeMm: 0.8, color: GEM_LOOK.emerald.color, clarity: 0.5, rotation: -35, dx: 3, dz: -1 }] } as DesignPatch)}>
              Try a toi-et-moi
            </button>
          </div>
        </section>
      )}

      {(has("accents") || (has("halo") && o.halo) || (has("pave") && o.pave)) && (
        <section id="sec-accents" style={{ display: "grid", gap: 12 }}>
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
          {!BEAD_GEMS.has(d.accents.gem) && (
            <>
              <span className="small muted">Pattern, repeated along every line of these stones. Add the same shape as often as you like (up to 12 stones per repeat).</span>
              <ShapeOrder chips shapes={d.accents.shapes} turns={d.accents.turns} twins={d.accents.twins} sizes={d.accents.sizes} max={12} onChange={(shapes, turns, twins, sizes) => onChange({ accents: { shapes, turns, twins: twins ?? [], sizes: sizes ?? [] } } as DesignPatch)} />
              <div className="chips" role="group" aria-label="Quick patterns">
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["oval", "round"], turns: [], sizes: [] } } as DesignPatch)}>Oval–round</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["emerald", "round", "round"], turns: [], sizes: [] } } as DesignPatch)}>Emerald–round–round</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["pear", "round"], turns: [], sizes: [] } } as DesignPatch)}>Pear–round</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["round", "round", "round", "marquise"], turns: [], sizes: [] } } as DesignPatch)}>3 rounds + marquise</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["round", "round", "round", "marquise"], turns: [0, 0, 0, 90] } })}>3 rounds + marquise turned across</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["pear", "pear"], turns: [0, 180], sizes: [] } } as DesignPatch)}>Pears, alternating up and down</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["round", "round", "baguette", "round"], turns: [0, 0, 0, 0], sizes: [2, 1, 1.2, 1], twins: [] } } as DesignPatch)}>Big round, small round, baguette</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["heart"], turns: [], sizes: [] } } as DesignPatch)}>All hearts</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["old-mine", "baguette"], turns: [0, 90], twins: [], sizes: [] } } as DesignPatch)}>Old-mine round + baguette across</button>
                <button type="button" className="chip" onClick={() => onChange({ accents: { shapes: ["round", "baguette"], turns: [0, 0], twins: [false, true], sizes: [] } } as DesignPatch)}>Round + twin baguettes</button>
              </div>
              <span className="small muted">Colours, one stone after another (leave empty for all one colour)</span>
              <div className="chips" role="group" aria-label="Stone colours">
                {d.accents.colors.map((c, i) => (
                  <span key={i} className="chip" style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 4px" }}>
                    <input type="color" aria-label={`Colour ${i + 1}`} value={c} style={{ width: 26, height: 22, border: 0, background: "none", padding: 0 }}
                      onChange={(e) => onChange({ accents: { colors: d.accents.colors.map((x, j) => (j === i ? e.target.value : x)) } } as DesignPatch)} />
                    <button type="button" className="chip" style={{ padding: "1px 7px" }} aria-label="Remove colour" onClick={() => onChange({ accents: { colors: d.accents.colors.filter((_, j) => j !== i) } } as DesignPatch)}>×</button>
                  </span>
                ))}
                <button type="button" className="chip" disabled={d.accents.colors.length >= 60} onClick={() => onChange({ accents: { colors: [...d.accents.colors, d.accents.colors[d.accents.colors.length - 1] ?? d.accents.color] } } as DesignPatch)}>+ colour</button>
              </div>
              <div className="chips" role="group" aria-label="Colour presets">
                {COLOR_PRESETS.map(([n, cols]) => (
                  <button key={n} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => onChange({ accents: { colors: cols } } as DesignPatch)}>
                    <span style={{ display: "inline-flex", marginRight: 6 }}>{cols.slice(0, 7).map((c, k) => <span key={k} style={{ width: 8, height: 8, borderRadius: 9, background: c, marginLeft: k ? -2 : 0 }} />)}</span>{n}
                  </button>
                ))}
                {d.accents.colors.length > 0 && <button type="button" className="chip" onClick={() => onChange({ accents: { colors: [] } } as DesignPatch)}>All one colour</button>}
              </div>
              <span className="small muted">Stone direction</span>
              <Chips name="Stone direction" options={["along", "across", "alternate"] as const} value={d.accents.orientation}
                fmt={(v) => (v === "along" ? "Along the line" : v === "across" ? "Across the line" : "Alternating")} onPick={(orientation) => onChange({ accents: { orientation } })} />
            </>
          )}
          <Range id="acc-ct" label="Each" value={d.accents.sizeCt} min={0.005} max={has("accentShapes") ? 6 : 1.5} step={0.005} format={(n) => `${n.toFixed(n >= 1 ? 2 : 3)} ct`} onChange={(sizeCt) => onChange({ accents: { sizeCt } })} />
        </section>
      )}

      {has("fringe") && (
        <section id="sec-fringe" style={{ display: "grid", gap: 12 }}>
          <h3>{d.style === "hoop" ? "Pearl cluster" : "Fringe & beads"}</h3>
          <Toggle id="fringe-on" checked={d.fringe.enabled} onChange={(enabled) => onChange({ fringe: { enabled } })}>{d.style === "hoop" ? "Cluster of pearls (or beads) over the front" : "Hanging beads"}</Toggle>
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

      {(has("setting") || has("halo") || has("accentTop") || has("pave") || has("hoop") || has("length") || has("chain") || has("count") || has("layers") || has("wrist") || has("links")) && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Construction</h3>
          {has("setting") && <Chips name="Setting" options={SETTINGS} value={d.setting.style} onPick={(style) => onChange({ setting: { style } })} />}
          {has("setting") && d.type === "ring" && (
            <Range id="height" label="Height" value={d.setting.height} min={0} max={1} step={0.05} format={(n) => (n < 0.2 ? "Low, seated in shank" : n < 0.6 ? "Medium" : "Tall cathedral")} onChange={(height) => onChange({ setting: { height } })} />
          )}
          {has("halo") && <Toggle id="halo" checked={o.halo} onChange={(halo) => setOpt({ halo })}>{d.style === "tennis" ? "A halo round every stone" : d.style === "wide-band" ? "Rows on the edges, gold between" : "Halo of accent stones"}</Toggle>}
          {has("accentTop") && <Toggle id="acc-top" checked={o.accentTop} onChange={(accentTop) => setOpt({ accentTop })}>Accent stone at the top</Toggle>}
          {has("pave") && <Toggle id="pave" checked={o.pave} onChange={(pave) => setOpt({ pave })}>{d.style === "flowers" ? "A diamond in each flower" : d.style === "open-bangle" ? "A channel of stones along the bangle" : "Set with stones"}</Toggle>}
          {has("pave") && o.pave && (d.style === "hoop" || d.style === "huggie") && (
            <>
              <span className="small muted">How far the stones run</span>
              <Chips name="Coverage" options={["front", "half", "full"] as const} value={o.paveCoverage}
                fmt={(v) => (v === "front" ? "Front two-thirds" : v === "half" ? "Bottom half" : "All the way up")} onPick={(paveCoverage) => setOpt({ paveCoverage })} />
              <span className="small muted">Which face of the wire</span>
              <Chips name="Face" options={["front", "outer", "inner"] as const} value={o.hoopFace}
                fmt={(v) => (v === "front" ? "Front edge (narrow)" : v === "outer" ? "Outer side (wide)" : "Inside")} onPick={(hoopFace) => setOpt({ hoopFace })} />
            </>
          )}
          {d.style === "hoop" && !c.none && (
            <Range id="charm-turn" label="Charm faces" value={o.charmTurn} min={-180} max={180} step={5}
              format={(n) => (n === 0 ? "Forward" : Math.abs(n) === 90 ? "Sideways" : `${n}°`)} onChange={(charmTurn) => setOpt({ charmTurn })} />
          )}
          {(d.style === "hoop" || d.style === "huggie") && d.type === "earrings" && (
            <Chips name="Hoop shape" options={["round", "oval", "paperclip"] as const} value={o.hoopShape} fmt={(v) => (v === "paperclip" ? "Paperclip (long)" : label(v))} onPick={(hoopShape) => setOpt({ hoopShape })} />
          )}
          {has("hoop") && <Range id="hoop" label="Diameter" value={o.hoopDiameterMm} min={8} max={70} step={1} format={(n) => `${n} mm`} onChange={(hoopDiameterMm) => setOpt({ hoopDiameterMm })} />}
          {has("length") && <Range id="length" label="Length" value={o.lengthIn} min={12} max={40} step={1} format={(n) => `${n}" (${Math.round(n * 2.54)} cm) · ${lengthName(n)}`} onChange={(lengthIn) => setOpt({ lengthIn })} />}
          {has("chain") && <Chips name="Chain" options={CHAIN_STYLES} value={o.chain} onPick={(chain) => setOpt({ chain })} />}
          {has("count") && <Range id="count" label={d.style === "swirl" ? "Ribbons" : d.style === "flowers" ? "Flowers" : d.style === "tassel" ? "Strands" : d.style === "payal" ? "Bells" : "Stones"} value={o.count} min={1} max={d.style === "swirl" ? 5 : d.style === "flowers" ? 12 : 80} step={1} onChange={(count) => setOpt({ count })} />}
          {has("links") && <Chips name="Links" options={["x", "chevron"] as const} value={o.linkStyle} fmt={(v) => (v === "x" ? "X links with pavé" : "Chevrons with stone rows")} onPick={(linkStyle) => setOpt({ linkStyle })} />}
          {has("layers") && <Range id="layers" label={d.style === "tennis" || d.style === "wide-band" ? "Rows" : d.style === "by-the-yard" ? "Times round the neck" : "Rows / strands"} value={o.layers} min={1} max={7} step={1} onChange={(layers) => setOpt({ layers })} />}
          {has("wrist") && (solidBracelet
            ? <><span className="small muted">Bangle size (Indian)</span><Chips name="Bangle size" options={BANGLE_SIZES} value={o.bangleSize} fmt={(s) => s} onPick={(bangleSize) => setOpt({ bangleSize })} /></>
            : <Range id="wrist" label="Wrist" value={o.wristCm} min={13} max={24} step={0.5} format={(n) => `${n} cm`} onChange={(wristCm) => setOpt({ wristCm })} />)}
        </section>
      )}

      {has("sides") && (
        <section id="sec-sides" style={{ display: "grid", gap: 12 }}>
          <h3>Side stones</h3>
          <Chips name="Side stones" options={SIDE_KINDS} value={d.sides.kind} onPick={(kind) => onChange({ sides: { kind } })} />
          {d.sides.kind !== "none" && d.type === "ring" && (
            <Chips name="Side stones sit" options={["level", "band"] as const} value={d.sides.follow}
              fmt={(v) => (v === "level" ? "Up beside the centre" : "Curving with the band, flush")} onPick={(follow) => onChange({ sides: { follow } })} />
          )}
          {d.sides.kind !== "none" && d.type === "ring" && (
            <Toggle id="side-hug" checked={d.sides.hug} onChange={(hug) => onChange({ sides: { hug } })}>Hug the centre stone (sized to it, set tight against it)</Toggle>
          )}
          {d.sides.kind !== "none" && d.sides.hug && d.type === "ring" && (
            <Range id="side-hug-frac" label="How far they wrap" value={d.sides.hugFrac} min={0.4} max={1} step={0.02} format={(n) => `${Math.round(n * 100)}% of the centre's length`} onChange={(hugFrac) => onChange({ sides: { hugFrac } })} />
          )}
          {d.sides.kind !== "none" && (!d.sides.hug || d.type !== "ring") && <Range id="side-ct" label="Each" value={d.sides.sizeCt} min={0.1} max={1.5} step={0.05} format={(n) => `${n.toFixed(2)} ct`} onChange={(sizeCt) => onChange({ sides: { sizeCt } })} />}
          <Toggle id="rose" checked={d.gallery.roseCut} onChange={(roseCut) => onChange({ gallery: { roseCut } })}>Rose-cut diamonds on the gallery</Toggle>
        </section>
      )}

      {has("band") && (
        <section style={{ display: "grid", gap: 12 }}>
          <h3>Band</h3>
          <span className="small muted">How the design meets the band</span>
          <Chips name="Profile" options={["raised", "low", "set-in", "flush"] as const} value={d.band.profile}
            fmt={(v) => (v === "raised" ? "Up on top of the band" : v === "low" ? "Low on the band" : v === "set-in" ? "Set into the band" : "Level with the band (flush)")} onPick={(profile) => onChange({ band: { profile } })} />
          <span className="small muted">Band shape</span>
          <Chips name="Band shape" options={["classic", "flat", "cigar"] as const} value={d.band.shape}
            fmt={(v) => (v === "classic" ? "Classic (rounded)" : v === "flat" ? "Flat" : "Cigar band (wide)")}
            onPick={(shape) => onChange({ band: { shape, ...(shape === "cigar" && d.band.widthMm < 6 ? { widthMm: 8 } : {}) } })} />
          <Chips name="Band finish" options={BAND_FINISHES} value={d.band.finish} onPick={(finish) => onChange({ band: { finish } })} />
          <span className="small muted">Stones down the band</span>
          <Chips name="Band stones" options={["none", "shoulders", "half", "full"] as const} value={d.band.pave}
            fmt={(v) => (v === "none" ? "None" : v === "shoulders" ? "On the shoulders" : v === "half" ? "Half way round" : "All the way round")} onPick={(pave) => onChange({ band: { pave } })} />
          {d.band.pave !== "none" && (
            <>
              <div className="row2">
                <label className="field" htmlFor="bp-gem"><span>Gem</span>
                  <GemSelect id="bp-gem" value={d.band.paveGem} options={GEMS} onPick={(paveGem) => onChange({ band: { paveGem, paveColor: GEM_LOOK[paveGem].color } })} />
                </label>
                <label className="field" htmlFor="bp-shape"><span>Shape</span>
                  <select id="bp-shape" value={d.band.paveShape} onChange={(e) => onChange({ band: { paveShape: e.target.value as Design["band"]["paveShape"] } })}>
                    {SHAPES.map((sh) => <option key={sh} value={sh}>{label(sh)}</option>)}
                  </select>
                </label>
              </div>
              <div className="row2">
                <Range id="bp-mm" label="Each, width" value={d.band.paveMm} min={0.8} max={4} step={0.1} format={(n) => `${n} mm`} onChange={(paveMm) => onChange({ band: { paveMm } })} />
                <Range id="bp-rows" label="Rows" value={d.band.paveRows} min={1} max={4} step={1} onChange={(paveRows) => onChange({ band: { paveRows } })} />
              </div>
            </>
          )}
          <div className="row2">
            <Range id="bw" label="Width" value={d.band.widthMm} min={1.5} max={16} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => onChange({ band: { widthMm } })} />
            <Range id="size" label="Size" value={d.ringSize} min={3} max={13} step={0.25} format={(n) => `US ${n} · Indian ${indianRingSize(n)}`} onChange={(ringSize) => onChange({ ringSize })} />
          </div>
        </section>
      )}

      <section id="sec-metal" style={{ display: "grid", gap: 12 }}>
        <h3>Metal</h3>
        <Chips name="Metal" options={METALS} value={d.metal} onPick={(metal) => onChange({ metal })} />
        {isGold(d.metal) && (
          <>
            <Chips name="Purity" options={KARATS} value={d.purity.karat as (typeof KARATS)[number]} fmt={(k) => `${k}k`} onPick={(karat) => onChange({ purity: { karat } })} />
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
