"use client";

import ShapeOrder from "../ShapeOrder";
import { CUTS, DROP_ARRANGE, DROP_KINDS, DropPartSchema, GEMS, GEM_LOOK, SHAPES, type DropPart, type Gem, gemLabel, lengthForShape } from "@/lib/design";
import { Chips, Dir, Num, Pick, colorInputStyle } from "./fields";

export const KIND_LABEL: Record<DropPart["kind"], string> = { stone: "Stone / cluster", strands: "Strands & fringe", frame: "Open frame", bow: "Bow" };
const ARRANGE_LABEL: Record<DropPart["arrange"], string> = { around: "All round", above: "Fan on top", below: "Fan below", sides: "Spray to the sides" };

/** what a new part of each kind starts as */
export const NEW_PART: Record<DropPart["kind"], Partial<DropPart>> = {
  stone: { kind: "stone", gapMm: 0.8 },
  strands: { kind: "strands", count: 5, perStrand: 2, small: { gem: "diamond", cut: "faceted", color: GEM_LOOK.diamond.color, shapes: ["pear"], widthMm: 2.6, rotation: 180, turns: [] }, spreadMm: 14, curveMm: 2.5, gapMm: 0.8 },
  frame: { kind: "frame", showStone: false, halo: true, stone: { ...DropPartSchema.parse({}).stone, shape: "octagon", lengthMm: 14, widthMm: 12 }, gapMm: 0.8 },
  bow: { kind: "bow", halo: true, haloMm: 1.1, spreadMm: 18, stone: { ...DropPartSchema.parse({}).stone, shape: "baguette", lengthMm: 4, widthMm: 2 }, gapMm: 0.8 },
};

type Props = {
  p: DropPart; i: number; count: number; above: DropPart[]; focused: boolean;
  set: (x: Partial<DropPart>) => void; onMove: (by: -1 | 1) => void; onCopy: () => void; onRemove: () => void;
};

/** the editor for one part of a drop: its position, its stone, its strands or petals, and its pavé */
export default function DropPartEditor({ p, i, count, above, focused, set, onMove, onCopy, onRemove }: Props) {
  const setStone = (x: Partial<DropPart["stone"]>) => set({ stone: { ...p.stone, ...x } });
  const setSmall = (x: Partial<DropPart["small"]>) => set({ small: { ...p.small, ...x } });
  const id = (s: string) => `dp-${i}-${s}`;
  const stoneWord = p.kind === "frame" ? "Stone inside the frame" : p.kind === "bow" ? "Stone in the knot" : "Stone";
  const smallWord = p.kind === "strands" ? "Strand stones" : "Petals & leaves";
  const paveWord = p.kind === "stone" ? "Halo" : p.kind === "strands" ? "Stones on the bar" : "Set with stones";
  return (
    <div id={`drop-part-${i}`} className={focused ? "flash-section" : undefined}
      style={{ display: "grid", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        <strong>{i + 1}. {KIND_LABEL[p.kind]}</strong>
        <span style={{ display: "flex", gap: 4 }}>
          <button type="button" className="chip" aria-label="Move up" disabled={i === 0} onClick={() => onMove(-1)}>↑</button>
          <button type="button" className="chip" aria-label="Move down" disabled={i === count - 1} onClick={() => onMove(1)}>↓</button>
          <button type="button" className="chip" disabled={count >= 10} onClick={onCopy}>Copy</button>
          <button type="button" className="chip" disabled={count === 1} onClick={onRemove}>Remove</button>
        </span>
      </div>
      <Chips name="Part kind" options={DROP_KINDS} value={p.kind} fmt={(k) => KIND_LABEL[k]} onPick={(kind) => set({ ...NEW_PART[kind], gapMm: p.gapMm, link: p.link })} />

      <details className="pos" open={p.anchor === "beside" || p.pair || !!p.offsetX || !!p.tilt || p.from >= 0}>
        <summary className="small">Position{i > 0 ? (p.anchor === "beside" ? ` · beside part ${(p.from >= 0 && p.from < i ? p.from : i - 1) + 1}` : ` · below part ${(p.from >= 0 && p.from < i ? p.from : i - 1) + 1}`) : ""}{p.pair ? " · pair" : ""}</summary>
        <div style={{ display: "grid", gap: 8, paddingTop: 8 }}>
          {i > 0 && (
            <>
              <Chips name="Placement" options={["below", "beside"] as const} value={p.anchor}
                fmt={(v) => (v === "below" ? "Hangs below" : "Sits beside")} onPick={(anchor) => set({ anchor, link: anchor === "beside" ? "direct" : p.link })} />
              <div className="row2">
                <label className="field" htmlFor={id("from")}><span>{p.anchor === "beside" ? "Beside" : "Hangs from"}</span>
                  <select id={id("from")} value={p.from >= 0 && p.from < i ? p.from : i - 1} onChange={(e) => set({ from: Number(e.target.value) === i - 1 ? -1 : Number(e.target.value) })}>
                    {above.map((q, j) => <option key={j} value={j}>Part {j + 1} · {KIND_LABEL[q.kind]}</option>)}
                  </select>
                </label>
                {p.anchor === "beside"
                  ? <Pick id={id("side")} text="Side" value={p.side} options={["left", "right"] as const} onPick={(side) => set({ side })} />
                  : <Pick id={id("link")} text="Joined by" value={p.link} options={["ring", "chain", "direct"] as const}
                      fmt={(v) => (v === "ring" ? "Jump ring (swings)" : v === "chain" ? "Fine chain" : "Fixed (no swing)")} onPick={(link) => set({ link })} />}
              </div>
              <Num id={id("gap")} text={p.anchor === "beside" ? "Space between" : "Space above"} value={p.gapMm} min={0} max={40} step={0.2} onChange={(gapMm) => set({ gapMm })} />
              <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="checkbox" checked={p.pair} onChange={(e) => set({ pair: e.target.checked })} />
                Matching twin on the other side (mirrored)
              </label>
            </>
          )}
          <div className="row2">
            <Num id={id("ox")} text="Shift sideways" value={p.offsetX} min={-40} max={40} step={0.25} onChange={(offsetX) => set({ offsetX })} />
            <Num id={id("oz")} text="Shift down" value={p.offsetZ} min={-40} max={40} step={0.25} onChange={(offsetZ) => set({ offsetZ })} />
          </div>
          <Num id={id("tilt")} text="Tilt the whole part" value={p.tilt} min={-90} max={90} step={1} unit="°" onChange={(tilt) => set({ tilt })} />
        </div>
      </details>

      {p.kind !== "strands" && (
        <>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={p.showStone} onChange={(e) => set({ showStone: e.target.checked })} />
            {p.kind === "frame" ? stoneWord : p.kind === "bow" ? stoneWord : "Centre stone"}
          </label>
          {(p.showStone || p.kind === "frame") && (
            <>
              {p.kind === "frame" && !p.showStone && <span className="small muted">Frame shape and size</span>}
              <div className="row2">
                {p.showStone && (
                  <label className="field" htmlFor={id("gem")}><span>Gem</span>
                    <select id={id("gem")} value={p.stone.gem} onChange={(e) => { const gem = e.target.value as Gem; setStone({ gem, ...GEM_LOOK[gem] }); }}>
                      {GEMS.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
                    </select>
                  </label>
                )}
                <Pick id={id("shape")} text="Shape" value={p.stone.shape} options={SHAPES}
                  onPick={(shape) => setStone({ shape, lengthMm: lengthForShape(p.stone.widthMm, shape) })} />
              </div>
              {p.showStone && (
                <div className="row2">
                  <Pick id={id("cut")} text="Cut" value={p.stone.cut} options={CUTS} onPick={(cut) => setStone({ cut, domeMm: cut === "cabochon" ? Math.round(p.stone.widthMm * 4) / 10 : 0.8 })} />
                  <label className="field" htmlFor={id("color")}><span>Colour</span>
                    <input id={id("color")} type="color" value={p.stone.color} onChange={(e) => setStone({ color: e.target.value })} style={colorInputStyle} />
                  </label>
                </div>
              )}
              <div className="row2">
                <Num id={id("len")} text="Length" value={p.stone.lengthMm} min={1} max={30} step={0.1} onChange={(lengthMm) => setStone({ lengthMm })} />
                <Num id={id("wid")} text="Width" value={p.stone.widthMm} min={1} max={30} step={0.1} onChange={(widthMm) => setStone({ widthMm })} />
              </div>
              <Dir value={p.stone.rotation} onPick={(rotation) => setStone({ rotation })} options={[[0, "Tip down"], [180, "Tip up"], [90, "Tip left"], [-90, "Tip right"]]} />
              <Num id={id("rot")} text="Angle" value={p.stone.rotation} min={-180} max={180} step={5} unit="°" onChange={(rotation) => setStone({ rotation })} />
            </>
          )}
        </>
      )}

      {p.kind === "strands" && (
        <>
          <div className="row2">
            <Num id={id("count")} text="Strands" value={p.count} min={1} max={15} step={1} unit="" onChange={(count) => set({ count })} />
            <Num id={id("per")} text="Stones per strand" value={p.perStrand} min={1} max={10} step={1} unit="" onChange={(perStrand) => set({ perStrand })} />
          </div>
          <div className="row2">
            <Num id={id("spread")} text="Width" value={p.spreadMm} min={0} max={70} step={0.5} onChange={(spreadMm) => set({ spreadMm })} />
            <Num id={id("curve")} text="Curve" value={p.curveMm} min={0} max={20} step={0.5} onChange={(curveMm) => set({ curveMm })} />
          </div>
          <Chips name="Lengths" options={["even", "v", "u"] as const} value={p.taper}
            fmt={(v) => (v === "even" ? "All the same" : v === "v" ? "Longest in the middle" : "Longest at the sides")} onPick={(taper) => set({ taper })} />
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={p.openMiddle} onChange={(e) => set({ openMiddle: e.target.checked })} />
            Leave the middle open (for a bigger drop below)
          </label>
        </>
      )}

      {(p.kind === "stone" || p.kind === "strands") && (
        <div style={{ display: "grid", gap: 8, borderTop: "1px dashed var(--line)", paddingTop: 8 }}>
          <span className="small muted">{smallWord}</span>
          {p.kind === "stone" && (
            <>
              <Num id={id("petals")} text="How many" value={p.count} min={0} max={24} step={1} unit="" onChange={(count) => set({ count })} />
              {p.count > 0 && <Chips name="Arrangement" options={DROP_ARRANGE} value={p.arrange} fmt={(a) => ARRANGE_LABEL[a]} onPick={(arrange) => set({ arrange })} />}
            </>
          )}
          {(p.kind === "strands" || p.count > 0) && (
            <>
              <div className="row2">
                <label className="field" htmlFor={id("sgem")}><span>Gem</span>
                  <select id={id("sgem")} value={p.small.gem} onChange={(e) => { const gem = e.target.value as Gem; setSmall({ gem, color: GEM_LOOK[gem].color }); }}>
                    {GEMS.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
                  </select>
                </label>
                <Pick id={id("scut")} text="Cut" value={p.small.cut} options={CUTS} onPick={(cut) => setSmall({ cut })} />
              </div>
              <span className="small muted">Shapes in order{p.kind === "strands" ? " down each strand" : ", repeating"}</span>
              <Dir value={p.small.rotation} onPick={(rotation) => setSmall({ rotation })}
                options={p.kind === "strands" ? [[0, "Tips down"], [180, "Tips up"]] : [[0, "Tips pointing out"], [180, "Tips pointing in"], [90, "Swirl"]]} />
              <ShapeOrder shapes={p.small.shapes} turns={p.small.turns} max={8} onChange={(shapes, turns) => setSmall({ shapes, turns })} />
              <div className="row2">
                <Num id={id("sw")} text="Each, width" value={p.small.widthMm} min={0.8} max={20} step={0.1} onChange={(widthMm) => setSmall({ widthMm })} />
                <Num id={id("sr")} text="Turn all" value={p.small.rotation} min={-180} max={180} step={5} unit="°" onChange={(rotation) => setSmall({ rotation })} />
              </div>
            </>
          )}
        </div>
      )}

      {(p.kind !== "stone" || p.showStone) && (
        <div style={{ display: "grid", gap: 8, borderTop: "1px dashed var(--line)", paddingTop: 8 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={p.kind === "strands" ? p.barStones : p.halo} onChange={(e) => set(p.kind === "strands" ? { barStones: e.target.checked } : { halo: e.target.checked })} />
            {paveWord}
          </label>
          {(p.kind === "strands" ? p.barStones : p.halo) && (
            <div className="row2">
              <Pick id={id("hshape")} text="Shape" value={p.haloShape} options={SHAPES} onPick={(haloShape) => set({ haloShape })} />
              <Num id={id("hmm")} text="Each, width" value={p.haloMm} min={0.6} max={6} step={0.1} onChange={(haloMm) => set({ haloMm })} />
            </div>
          )}
        </div>
      )}

      {(p.kind === "frame" || p.kind === "bow") && (
        <>
          {p.kind === "bow" && <Num id={id("bw")} text="Bow width" value={p.spreadMm} min={8} max={60} step={0.5} onChange={(spreadMm) => set({ spreadMm })} />}
          {p.kind === "frame" && p.showStone && <Num id={id("fg")} text="Space around the stone" value={p.spreadMm} min={0} max={15} step={0.2} onChange={(spreadMm) => set({ spreadMm })} />}
          <div className="row2">
            <label className="field" htmlFor={id("pgem")}><span>Pavé gem</span>
              <select id={id("pgem")} value={p.small.gem} onChange={(e) => { const gem = e.target.value as Gem; setSmall({ gem, color: GEM_LOOK[gem].color }); }}>
                {GEMS.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
              </select>
            </label>
            <Pick id={id("pcut")} text="Pavé cut" value={p.small.cut} options={["faceted", "polki", "rose-cut"] as const} onPick={(cut) => setSmall({ cut })} />
          </div>
        </>
      )}
    </div>
  );
}
