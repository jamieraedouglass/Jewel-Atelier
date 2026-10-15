"use client";

import { SHAPES, label } from "@/lib/design";

type Shape = (typeof SHAPES)[number];
type Props = {
  shapes: Shape[];
  turns: number[];
  max: number;
  onChange: (shapes: Shape[], turns: number[]) => void;
  /** show "+ shape" as chips (true) or a compact select */
  chips?: boolean;
};

const STEPS = [0, 45, 90, 135, 180, -135, -90, -45];
const next = (t: number) => STEPS[(STEPS.indexOf(STEPS.reduce((a, b) => (Math.abs(b - t) < Math.abs(a - t) ? b : a))) + 1) % STEPS.length];

/** a little arrow showing which way a stone points */
function Arrow({ deg }: { deg: number }) {
  return (
    <svg width="12" height="12" viewBox="-6 -6 12 12" aria-hidden="true" style={{ transform: `rotate(${deg}deg)`, verticalAlign: "-1px" }}>
      <path d="M0 -5 L0 4 M-3 1 L0 4 L3 1" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The repeating order of stone shapes, each with its own direction:
 * tap the arrow to turn that stone (0°, 45°, 90°…), tap × to remove it.
 */
export default function ShapeOrder({ shapes, turns, max, onChange, chips = false }: Props) {
  const turnAt = (i: number) => turns[i] ?? 0;
  const setTurn = (i: number, t: number) => onChange(shapes, shapes.map((_, j) => (j === i ? t : turnAt(j))));
  const remove = (i: number) => onChange(shapes.filter((_, j) => j !== i), shapes.map((_, j) => turnAt(j)).filter((_, j) => j !== i));
  const add = (s: Shape) => onChange([...shapes, s], [...shapes.map((_, j) => turnAt(j)), 0]);
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div className="chips" role="group" aria-label="Shape order">
        {shapes.map((s, i) => (
          <span key={`${s}-${i}`} className="chip" style={{ display: "inline-flex", gap: 6, alignItems: "center", padding: "2px 4px 2px 10px" }}>
            {label(s)}
            <button type="button" className="chip" style={{ padding: "2px 8px" }} title="Turn this stone" aria-label={`Turn ${label(s)} (now ${turnAt(i)}°)`}
              onClick={() => setTurn(i, next(turnAt(i)))}><Arrow deg={turnAt(i)} /> {turnAt(i)}°</button>
            <button type="button" className="chip" style={{ padding: "2px 8px" }} aria-label={`Remove ${label(s)}`} disabled={shapes.length === 1} onClick={() => remove(i)}>×</button>
          </span>
        ))}
        {!chips && (
          <select aria-label="Add a shape" value="" disabled={shapes.length >= max} onChange={(e) => e.target.value && add(e.target.value as Shape)}>
            <option value="">+ shape</option>
            {SHAPES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
          </select>
        )}
      </div>
      {chips && (
        <div className="chips" role="group" aria-label="Add shape">
          {SHAPES.map((s) => <button key={s} type="button" className="chip" disabled={shapes.length >= max} onClick={() => add(s)}>+ {label(s)}</button>)}
        </div>
      )}
      <span className="small muted">Tap an arrow to turn just that stone, so some point one way and others another.</span>
    </div>
  );
}
