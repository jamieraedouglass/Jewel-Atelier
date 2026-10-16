"use client";

import { GroupedOptions } from "./controls/fields";
import {
  CUTS, FRAME_KINDS, FRAME_PRESETS, FrameSchema, GEMS, GEM_LOOK, SHAPES,
  type Design, type DesignPatch, type Frame, type Gem, gemLabel, label,
} from "@/lib/design";

type Props = { design: Design; onChange: (patch: DesignPatch) => void };

const KIND: Record<Frame["kind"], string> = { stones: "Stones", milgrain: "Milgrain border", metal: "Plain gold band" };
const OUTLINES = ["round", "oval", "cushion", "octagon", "hexagon", "emerald", "asscher", "marquise", "pear", "heart", "princess", "kite", "shield"] as const;

function Sel<T extends string>({ id, text, value, options, fmt, onPick }: { id: string; text: string; value: T; options: readonly T[]; fmt?: (v: T) => string; onPick: (v: T) => void }) {
  return (
    <label className="field" htmlFor={id}><span>{text}</span>
      <select id={id} value={value} onChange={(e) => onPick(e.target.value as T)}>{options.map((o) => <option key={o} value={o}>{fmt ? fmt(o) : label(o)}</option>)}</select>
    </label>
  );
}

/** The layers round the centre stone of an Art Deco / cocktail piece, inside out. */
export default function FramesEditor({ design: d, onChange }: Props) {
  const frames = d.frames;
  const setFrames = (next: Frame[]) => onChange({ frames: next } as DesignPatch);
  const set = (i: number, p: Partial<Frame>) => setFrames(frames.map((f, j) => (j === i ? FrameSchema.parse({ ...f, ...p }) : f)));
  const move = (i: number, by: number) => { const n = [...frames]; const [x] = n.splice(i, 1); n.splice(i + by, 0, x); setFrames(n); };
  return (
    <section id="sec-frames" style={{ display: "grid", gap: 12 }}>
      <h3>Layers round the stone</h3>
      <p className="muted small" style={{ margin: 0 }}>Built from the centre outward. Each layer can be stones, a milgrain border or a plain gold band, in its own shape, and stones can lie along the layer or fan out from the centre (calibré, ballerina baguettes, petals).</p>
      <label className="field" htmlFor="frame-preset"><span>Start from a classic</span>
        <select id="frame-preset" value="" onChange={(e) => {
          const p = FRAME_PRESETS[Number(e.target.value)];
          if (p) onChange({ frames: p.frames.map((f) => FrameSchema.parse(f)), ...(p.center ? { center: p.center } : {}), name: p.name } as DesignPatch);
        }}>
          <option value="">Choose…</option>
          <GroupedOptions items={FRAME_PRESETS} text={(p) => `${p.name} — ${p.blurb}`} />
        </select>
      </label>
      {frames.map((f, i) => {
        const id = (s: string) => `fr-${i}-${s}`;
        return (
          <div key={i} style={{ display: "grid", gap: 8, border: "1px solid var(--line)", borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <strong>{i + 1}. {f.kind === "stones" ? `${gemLabel(f.gem)} ${label(f.shape).toLowerCase()}s` : KIND[f.kind]}</strong>
              <span style={{ display: "flex", gap: 4 }}>
                <button type="button" className="chip" aria-label="Move in" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button type="button" className="chip" aria-label="Move out" disabled={i === frames.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button type="button" className="chip" disabled={frames.length >= 8} onClick={() => setFrames([...frames.slice(0, i + 1), f, ...frames.slice(i + 1)])}>Copy</button>
                <button type="button" className="chip" onClick={() => setFrames(frames.filter((_, j) => j !== i))}>Remove</button>
              </span>
            </div>
            <div className="chips" role="group" aria-label="Layer kind">
              {FRAME_KINDS.map((k) => <button key={k} type="button" className="chip" aria-pressed={f.kind === k} onClick={() => set(i, { kind: k })}>{KIND[k]}</button>)}
            </div>
            <div className="row2">
              <Sel id={id("outline")} text="Layer shape" value={f.outline} options={OUTLINES as unknown as readonly Frame["outline"][]} onPick={(outline) => set(i, { outline })} />
              <label className="field" htmlFor={id("gap")}><span>Space inside · {+f.gapMm.toFixed(2)} mm</span>
                <input id={id("gap")} type="range" min={0} max={4} step={0.05} value={f.gapMm} onChange={(e) => set(i, { gapMm: Number(e.target.value) })} />
              </label>
            </div>
            {f.kind !== "milgrain" && (
              <label className="field" htmlFor={id("w")}><span>{f.kind === "stones" ? "Each stone, width" : "Band width"} · {+f.widthMm.toFixed(2)} mm</span>
                <input id={id("w")} type="range" min={0.6} max={8} step={0.1} value={f.widthMm} onChange={(e) => set(i, { widthMm: Number(e.target.value) })} />
              </label>
            )}
            {f.kind === "stones" && (
              <>
                <div className="row2">
                  <label className="field" htmlFor={id("gem")}><span>Gem</span>
                    <select id={id("gem")} value={f.gem} onChange={(e) => { const gem = e.target.value as Gem; set(i, { gem, color: GEM_LOOK[gem].color }); }}>
                      {GEMS.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
                    </select>
                  </label>
                  <label className="field" htmlFor={id("color")}><span>Colour</span>
                    <input id={id("color")} type="color" value={f.color} onChange={(e) => set(i, { color: e.target.value })} style={{ width: "100%", height: 36, border: 0, background: "none" }} />
                  </label>
                </div>
                <div className="row2">
                  <Sel id={id("shape")} text="Stone shape" value={f.shape} options={SHAPES} onPick={(shape) => set(i, { shape })} />
                  <Sel id={id("cut")} text="Cut" value={f.cut} options={CUTS.filter((x) => x !== "briolette")} onPick={(cut) => set(i, { cut })} />
                </div>
                <div className="chips" role="group" aria-label="Direction">
                  <button type="button" className="chip" aria-pressed={f.direction === "along"} onClick={() => set(i, { direction: "along" })}>Along the layer</button>
                  <button type="button" className="chip" aria-pressed={f.direction === "radial"} onClick={() => set(i, { direction: "radial" })}>Fanning out (calibré, ballerina, petals)</button>
                </div>
                <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <input type="checkbox" checked={!!f.alt} onChange={(e) => set(i, { alt: e.target.checked ? { gem: "diamond", color: GEM_LOOK.diamond.color, shape: "round", cut: "faceted" } : null })} />
                  Stripes of a second gem
                </label>
                {f.alt && (
                  <div className="row2">
                    <label className="field" htmlFor={id("agem")}><span>Second gem</span>
                      <select id={id("agem")} value={f.alt.gem} onChange={(e) => { const gem = e.target.value as Gem; set(i, { alt: { ...f.alt!, gem, color: GEM_LOOK[gem].color } }); }}>
                        {GEMS.map((g) => <option key={g} value={g}>{gemLabel(g)}</option>)}
                      </select>
                    </label>
                    <Sel id={id("ashape")} text="Its shape" value={f.alt.shape} options={SHAPES} onPick={(shape) => set(i, { alt: { ...f.alt!, shape } })} />
                    <label className="field" htmlFor={id("every")}><span>One after every · {f.every}</span>
                      <input id={id("every")} type="range" min={1} max={8} step={1} value={f.every} onChange={(e) => set(i, { every: Number(e.target.value) })} />
                    </label>
                    <Sel id={id("acut")} text="Its cut" value={f.alt.cut} options={CUTS.filter((x) => x !== "briolette")} onPick={(cut) => set(i, { alt: { ...f.alt!, cut } })} />
                  </div>
                )}
              </>
            )}
          </div>
        );
      })}
      <div className="chips" role="group" aria-label="Add a layer">
        <button type="button" className="btn" disabled={frames.length >= 8} onClick={() => setFrames([...frames, FrameSchema.parse({})])}>+ Stones</button>
        <button type="button" className="btn" disabled={frames.length >= 8} onClick={() => setFrames([...frames, FrameSchema.parse({ kind: "milgrain", outline: frames[frames.length - 1]?.outline ?? "round" })])}>+ Milgrain</button>
        <button type="button" className="btn" disabled={frames.length >= 8} onClick={() => setFrames([...frames, FrameSchema.parse({ kind: "metal", widthMm: 0.6, outline: frames[frames.length - 1]?.outline ?? "round" })])}>+ Gold band</button>
      </div>
    </section>
  );
}
