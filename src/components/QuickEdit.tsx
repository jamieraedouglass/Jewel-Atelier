"use client";

import { GEMS, GEM_LOOK, KARATS, METALS, SHAPES, SIDE_KINDS, type Design, type DesignPatch, type DropPart, type Gem, gemLabel, isGold, label, matchingVariety, updateDropPart, uses, varietiesOf, varietyLook } from "@/lib/design";
import { accentMaxCt } from "./controls/AccentsSection";
import type { Pick } from "./canvas/types";

const TITLE: Record<Pick["part"], string> = {
  center: "Main stone", accents: "Small stones", sides: "Side stones", metal: "Metal", fringe: "Beads", extra: "Extra stone", motif: "Motif", drop: "Part",
};

type Props = { pick: Pick; design: Design; onChange: (p: DesignPatch) => void; onMore: (part: Pick["part"], index?: number) => void; onClose: () => void };

/** A small editor that opens where you clicked on the paused 3D piece. */
export default function QuickEdit({ pick, design: d, onChange, onMore, onClose }: Props) {
  const chip = (on: boolean, text: string, act: () => void) => (
    <button key={text} type="button" className="chip" aria-pressed={on} onClick={act}>{text}</button>
  );
  const gemSelect = (value: Gem, set: (g: Gem) => void) => (
    <select value={value} onChange={(e) => set(e.target.value as Gem)} aria-label="Gem">
      {GEMS.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
    </select>
  );
  const part = pick.part === "center" && d.center.none ? "metal" : pick.part;
  const di = pick.index ?? 0;
  const dp = part === "drop" ? d.drop.parts[di] : undefined;
  const setDp = (x: Partial<DropPart>) => onChange({ drop: { parts: updateDropPart(d.drop.parts, di, x) } } as DesignPatch);
  const title = dp ? `Part ${di + 1}` : TITLE[part];

  return (
    <div role="dialog" aria-label={`Edit ${title}`} className="quick"
      style={{ left: pick.x, top: pick.y }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong>{title}</strong>
        <button type="button" className="chip" onClick={onClose} aria-label="Close">×</button>
      </div>

      {part === "center" && (
        <>
          {gemSelect(d.center.gem, (gem) => onChange({ center: { gem, ...GEM_LOOK[gem], label: gemLabel(gem) } }))}
          {varietiesOf(d.center.gem).length > 0 && (
            <div className="chips" role="group" aria-label="Colour grade">
              {varietiesOf(d.center.gem).map((v) => chip(matchingVariety(d.center.gem, d.center)?.id === v.id, v.name,
                () => onChange({ center: { ...varietyLook(v), label: `${v.name} ${gemLabel(d.center.gem).toLowerCase()}` } })))}
            </div>
          )}
          <div className="chips">{SHAPES.slice(0, 10).map((s) => chip(d.center.shape === s, label(s), () => onChange({ center: { shape: s } })))}</div>
          <label className="field"><span>Angle · {d.center.rotation}°</span>
            <input type="range" min={-180} max={180} step={5} value={d.center.rotation} onChange={(e) => onChange({ center: { rotation: Number(e.target.value) } })} />
          </label>
        </>
      )}

      {part === "accents" && (
        <>
          {gemSelect(d.accents.gem, (gem) => onChange({ accents: { gem, color: GEM_LOOK[gem].color } }))}
          <div className="chips">
            {chip(d.accents.shapes.join() === "round", "All round", () => onChange({ accents: { shapes: ["round"], turns: [] } }))}
            {chip(d.accents.shapes.join() === "oval,round", "Oval–round", () => onChange({ accents: { shapes: ["oval", "round"], turns: [] } }))}
            {chip(d.accents.shapes.join() === "round,round,round,marquise", "3 rounds + marquise", () => onChange({ accents: { shapes: ["round", "round", "round", "marquise"], turns: [] } }))}
            {chip(d.accents.shapes.join() === "baguette", "Baguettes", () => onChange({ accents: { shapes: ["baguette"], turns: [] } }))}
          </div>
          <div className="chips">
            {(["along", "across", "alternate"] as const).map((o) => chip(d.accents.orientation === o, o === "alternate" ? "Alternate" : label(o), () => onChange({ accents: { orientation: o } })))}
          </div>
          <label className="field"><span>Each · {d.accents.sizeCt.toFixed(3)} ct</span>
            <input type="range" min={0.005} max={accentMaxCt(uses(d, "accentShapes"))} step={0.005} value={d.accents.sizeCt} onChange={(e) => onChange({ accents: { sizeCt: Number(e.target.value) } })} />
          </label>
        </>
      )}

      {part === "sides" && <div className="chips">{SIDE_KINDS.map((k) => chip(d.sides.kind === k, label(k), () => onChange({ sides: { kind: k } })))}</div>}

      {part === "metal" && (
        <>
          <div className="chips">{METALS.map((mt) => chip(d.metal === mt, label(mt), () => onChange({ metal: mt })))}</div>
          {isGold(d.metal) && <div className="chips">{KARATS.map((k) => chip(d.purity.karat === k, `${k}k`, () => onChange({ purity: { karat: k } })))}</div>}
        </>
      )}

      {part === "fringe" && (
        <>
          <div className="chips">{chip(d.fringe.enabled, d.fringe.enabled ? "Beads on" : "Beads off", () => onChange({ fringe: { enabled: !d.fringe.enabled } }))}</div>
          {gemSelect(d.fringe.gem, (gem) => onChange({ fringe: { gem, color: GEM_LOOK[gem].color } }))}
        </>
      )}

      {part === "motif" && <div className="chips">{(["smooth", "millegrain", "rope"] as const).map((e) => chip(d.motif.edge === e, `${label(e)} edge`, () => onChange({ motif: { edge: e } })))}</div>}

      {dp && (
        <>
          {dp.showStone && dp.kind !== "strands" && (
            <>
              <span className="small muted">Stone</span>
              {gemSelect(dp.stone.gem, (gem) => setDp({ stone: { ...dp.stone, gem, ...GEM_LOOK[gem] } }))}
              <div className="chips">{SHAPES.slice(0, 12).map((s) => chip(dp.stone.shape === s, label(s), () => setDp({ stone: { ...dp.stone, shape: s } })))}</div>
              <label className="field"><span>Angle · {dp.stone.rotation}°</span>
                <input type="range" min={-180} max={180} step={5} value={dp.stone.rotation} onChange={(e) => setDp({ stone: { ...dp.stone, rotation: Number(e.target.value) } })} />
              </label>
            </>
          )}
          <span className="small muted">{dp.kind === "strands" ? "Strand stones" : "Small stones"}</span>
          {gemSelect(dp.small.gem, (gem) => setDp({ small: { ...dp.small, gem, color: GEM_LOOK[gem].color } }))}
          {dp.kind === "strands" && (
            <label className="field"><span>Strands · {dp.count}</span>
              <input type="range" min={1} max={15} step={1} value={dp.count} onChange={(e) => setDp({ count: Number(e.target.value) })} />
            </label>
          )}
        </>
      )}

      {part === "extra" && <p className="small muted" style={{ margin: 0 }}>Each extra stone has its own gem, shape, size, angle and position.</p>}

      <button type="button" className="btn" onClick={() => onMore(part, pick.index)}>All {title.toLowerCase()} settings</button>
    </div>
  );
}
