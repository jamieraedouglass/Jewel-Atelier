"use client";

import ShapeOrder from "./ShapeOrder";
import {
  CUTS, DROP_ARRANGE, DROP_KINDS, DROP_PRESETS, DropPartSchema, GEMS, GEM_LOOK, SHAPES, SHAPE_RATIO,
  type Design, type DesignPatch, type DropPart, type Gem, label,
} from "@/lib/design";

type Props = { design: Design; onChange: (patch: DesignPatch) => void; focusIndex?: number | null };

const KIND_LABEL: Record<DropPart["kind"], string> = { stone: "Stone / cluster", strands: "Strands & fringe", frame: "Open frame", bow: "Bow" };
const ARRANGE_LABEL: Record<DropPart["arrange"], string> = { around: "All round", above: "Fan on top", below: "Fan below", sides: "Spray to the sides" };
const gemLabel = (g: string) => (g === "cats-eye" ? "Cat's eye" : label(g));

const NEW_PART: Record<DropPart["kind"], Partial<DropPart>> = {
  stone: { kind: "stone", gapMm: 0.8 },
  strands: { kind: "strands", count: 5, perStrand: 2, small: { gem: "diamond", cut: "faceted", color: GEM_LOOK.diamond.color, shapes: ["pear"], widthMm: 2.6, rotation: 180, turns: [] }, spreadMm: 14, curveMm: 2.5, gapMm: 0.8 },
  frame: { kind: "frame", showStone: false, halo: true, stone: { ...DropPartSchema.parse({}).stone, shape: "octagon", lengthMm: 14, widthMm: 12 }, gapMm: 0.8 },
  bow: { kind: "bow", halo: true, haloMm: 1.1, spreadMm: 18, stone: { ...DropPartSchema.parse({}).stone, shape: "baguette", lengthMm: 4, widthMm: 2 }, gapMm: 0.8 },
};

function Num({ id, text, value, min, max, step, unit = "mm", onChange }: { id: string; text: string; value: number; min: number; max: number; step: number; unit?: string; onChange: (n: number) => void }) {
  return (
    <label className="field" htmlFor={id}>
      <span>{text} · <b style={{ fontWeight: 400, color: "var(--fg)" }}>{value}{unit && ` ${unit}`}</b></span>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Pick<T extends string>({ id, text, value, options, fmt, onPick }: { id: string; text: string; value: T; options: readonly T[]; fmt?: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <label className="field" htmlFor={id}><span>{text}</span>
      <select id={id} value={value} onChange={(e) => onPick(e.target.value as T)}>
        {options.map((o) => <option key={o} value={o}>{fmt ? fmt(o) : label(o)}</option>)}
      </select>
    </label>
  );
}

function Chips<T extends string>({ name, options, value, fmt, onPick }: { name: string; options: readonly T[]; value: T; fmt?: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <div className="chips" role="group" aria-label={name}>
      {options.map((o) => <button key={o} type="button" className="chip" aria-pressed={o === value} onClick={() => onPick(o)}>{fmt ? fmt(o) : label(o)}</button>)}
    </div>
  );
}

/** plain-words direction presets for pears, hearts, marquises and briolettes */
function Dir({ value, options, onPick }: { value: number; options: [number, string][]; onPick: (deg: number) => void }) {
  return (
    <div className="chips" role="group" aria-label="Which way the stones point">
      {options.map(([deg, text]) => <button key={deg} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={value === deg} onClick={() => onPick(deg)}>{text}</button>)}
    </div>
  );
}

/** Build drops, chandeliers and drop pendants part by part, from the top down. */
export default function DropComposer({ design: d, onChange, focusIndex }: Props) {
  const parts = d.drop.parts;
  const setParts = (next: DropPart[]) => onChange({ drop: { parts: next } } as DesignPatch);
  const setPart = (i: number, p: Partial<DropPart>) => setParts(parts.map((x, j) => (j === i ? DropPartSchema.parse({ ...x, ...p }) : x)));
  const move = (i: number, by: number) => { const n = [...parts]; const [x] = n.splice(i, 1); n.splice(i + by, 0, x); setParts(n); };
  const earrings = d.type === "earrings";

  return (
    <section id="sec-drop" style={{ display: "grid", gap: 12 }}>
      <h3>Build it part by part</h3>
      <p className="muted small" style={{ margin: 0 }}>
        Parts hang one below the other, top first. Each has its own stones: a stone with a halo or petals, strands or a fringe, an open frame, or a bow.
        Pause the 3D view and click a part to jump to it.
      </p>
      <label className="field" htmlFor="drop-preset"><span>Start from a classic</span>
        <select id="drop-preset" value="" onChange={(e) => { const p = DROP_PRESETS[Number(e.target.value)]; if (p) onChange({ name: p.name, drop: { parts: p.parts.map((x) => DropPartSchema.parse(x)) } } as DesignPatch); }}>
          <option value="">Choose…</option>
          {DROP_PRESETS.map((p, i) => <option key={p.name} value={i}>{p.name} — {p.blurb}</option>)}
        </select>
      </label>

      {parts.map((p, i) => {
        const set = (x: Partial<DropPart>) => setPart(i, x);
        const setStone = (x: Partial<DropPart["stone"]>) => set({ stone: { ...p.stone, ...x } });
        const setSmall = (x: Partial<DropPart["small"]>) => set({ small: { ...p.small, ...x } });
        const id = (s: string) => `dp-${i}-${s}`;
        const stoneWord = p.kind === "frame" ? "Stone inside the frame" : p.kind === "bow" ? "Stone in the knot" : "Stone";
        const smallWord = p.kind === "strands" ? "Strand stones" : "Petals & leaves";
        const paveWord = p.kind === "stone" ? "Halo" : p.kind === "strands" ? "Stones on the bar" : "Set with stones";
        return (
          <div key={i} id={`drop-part-${i}`} className={focusIndex === i ? "flash-section" : undefined}
            style={{ display: "grid", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <strong>{i + 1}. {KIND_LABEL[p.kind]}</strong>
              <span style={{ display: "flex", gap: 4 }}>
                <button type="button" className="chip" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="chip" aria-label="Move down" disabled={i === parts.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="chip" disabled={parts.length >= 10} onClick={() => setParts([...parts.slice(0, i + 1), p, ...parts.slice(i + 1)])}>Copy</button>
                <button type="button" className="chip" disabled={parts.length === 1} onClick={() => setParts(parts.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </div>
            <Chips name="Part kind" options={DROP_KINDS} value={p.kind} fmt={(k) => KIND_LABEL[k]} onPick={(kind) => set({ ...NEW_PART[kind], gapMm: p.gapMm, link: p.link })} />

            {i > 0 && (
              <div className="row2">
                <Pick id={id("link")} text="Joined by" value={p.link} options={["ring", "chain", "direct"] as const}
                  fmt={(v) => (v === "ring" ? "Jump ring (swings)" : v === "chain" ? "Fine chain" : "Fixed (no swing)")} onPick={(link) => set({ link })} />
                <Num id={id("gap")} text="Space above" value={p.gapMm} min={0} max={40} step={0.2} onChange={(gapMm) => set({ gapMm })} />
              </div>
            )}

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
                        onPick={(shape) => setStone({ shape, lengthMm: Math.round(p.stone.widthMm * SHAPE_RATIO[shape] * 10) / 10 })} />
                    </div>
                    {p.showStone && (
                      <div className="row2">
                        <Pick id={id("cut")} text="Cut" value={p.stone.cut} options={CUTS} onPick={(cut) => setStone({ cut, domeMm: cut === "cabochon" ? Math.round(p.stone.widthMm * 4) / 10 : 0.8 })} />
                        <label className="field" htmlFor={id("color")}><span>Colour</span>
                          <input id={id("color")} type="color" value={p.stone.color} onChange={(e) => setStone({ color: e.target.value })} style={{ width: "100%", height: 36, border: 0, background: "none" }} />
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
      })}

      <div className="chips" role="group" aria-label="Add a part">
        {DROP_KINDS.map((k) => (
          <button key={k} type="button" className="btn" disabled={parts.length >= 10}
            onClick={() => setParts([...parts, DropPartSchema.parse(NEW_PART[k])])}>+ {KIND_LABEL[k]}</button>
        ))}
      </div>
      {earrings && (
        <>
          <Chips name="Top" options={["post", "hook"] as const} value={d.drop.top} fmt={(v) => (v === "post" ? "Stud post" : "French hook")} onPick={(top) => onChange({ drop: { top } } as DesignPatch)} />
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={d.mirrorPair} onChange={(e) => onChange({ mirrorPair: e.target.checked })} />
            Mirror the second earring
          </label>
        </>
      )}
    </section>
  );
}
