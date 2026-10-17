"use client";

import { CUTS, GEMS, GEM_LOOK, SHAPES, type DesignPatch, type ExtraStone, label, lengthForShape } from "@/lib/design";
import { Chips, GemSelect, Range, sectionStyle, type SectionProps } from "./fields";
import ColourGrade from "./ColourGrade";

const NEW_STONE: ExtraStone = { gem: "diamond", cut: "faceted", shape: "pear", lengthMm: 7, widthMm: 5, domeMm: 0.8, color: GEM_LOOK.diamond.color, clarity: 0.95, glow: 0, rotation: 0, dx: 0, dz: 0 };
const TOI_ET_MOI: DesignPatch = {
  center: { shape: "pear", cut: "faceted", gem: "diamond", lengthMm: 8, widthMm: 5.5, domeMm: 0.8, rotation: 35, color: GEM_LOOK.diamond.color, clarity: 0.95 },
  extraStones: [{ gem: "emerald", cut: "faceted", shape: "emerald", lengthMm: 7, widthMm: 5, domeMm: 0.8, color: GEM_LOOK.emerald.color, clarity: 0.5, rotation: -35, dx: 3, dz: -1 }],
} as DesignPatch;

export default function ExtraStonesSection({ d, onChange }: SectionProps) {
  const setStones = (extraStones: ExtraStone[]) => onChange({ extraStones } as DesignPatch);
  return (
    <section id="sec-extra" style={sectionStyle}>
      <h3>{d.type === "ring" ? "Second stone" : "More stones in each stud"}</h3>
      <p className="muted small" style={{ margin: 0 }}>{d.type === "ring"
        ? "Sits beside the main stone. Give it its own gem, cut, shape, size and angle, and nudge it into place."
        : "Each extra stone sits below the one before it. Give each its own gem, cut, shape, size and angle, and nudge it into place."}</p>
      {d.extraStones.map((e, i) => {
        const set = (p: Partial<ExtraStone>) => setStones(d.extraStones.map((x, j) => (j === i ? { ...x, ...p } : x)));
        return (
          <div key={i} style={{ display: "grid", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong>Stone {i + 2}</strong>
              <button type="button" className="chip" onClick={() => setStones(d.extraStones.filter((_, j) => j !== i))}>Remove</button>
            </div>
            <div className="row2">
              <label className="field" htmlFor={`x-gem-${i}`}><span>Gem</span>
                <GemSelect id={`x-gem-${i}`} value={e.gem} options={GEMS} onPick={(gem) => set({ gem, ...GEM_LOOK[gem] })} />
              </label>
              <label className="field" htmlFor={`x-shape-${i}`}><span>Shape</span>
                <select id={`x-shape-${i}`} value={e.shape} onChange={(ev) => { const shape = ev.target.value as ExtraStone["shape"]; set({ shape, lengthMm: lengthForShape(e.widthMm, shape) }); }}>
                  {SHAPES.map((sh) => <option key={sh} value={sh}>{label(sh)}</option>)}
                </select>
              </label>
            </div>
            <Chips name="Cut" options={CUTS} value={e.cut} onPick={(cut) => set({ cut })} />
            <div className="row2">
              <Range id={`x-l-${i}`} label="Length" value={e.lengthMm} min={1} max={30} step={0.1} format={(n) => `${n} mm`} onChange={(lengthMm) => set({ lengthMm })} />
              <Range id={`x-w-${i}`} label="Width" value={e.widthMm} min={1} max={30} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => set({ widthMm })} />
            </div>
            <ColourGrade id={`x-${i}`} gem={e.gem} look={e} onPick={(look) => set(look)} />
            <Range id={`x-a-${i}`} label="Angle" value={e.rotation} min={-180} max={180} step={5} format={(n) => `${n}°`} onChange={(rotation) => set({ rotation })} />
            <div className="row2">
              <Range id={`x-dx-${i}`} label="Shift sideways" value={e.dx} min={-15} max={15} step={0.25} format={(n) => `${n} mm`} onChange={(dx) => set({ dx })} />
              <Range id={`x-dz-${i}`} label="Shift down" value={e.dz} min={-15} max={15} step={0.25} format={(n) => `${n} mm`} onChange={(dz) => set({ dz })} />
            </div>
          </div>
        );
      })}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn" disabled={d.extraStones.length >= (d.type === "ring" ? 1 : 6)} onClick={() => setStones([...d.extraStones, NEW_STONE])}>
          + Add a stone
        </button>
        <button type="button" className="btn" onClick={() => onChange(TOI_ET_MOI)}>Try a toi-et-moi</button>
      </div>
    </section>
  );
}
