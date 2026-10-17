"use client";

import {
  DROP_KINDS, DROP_PRESETS, DropPartSchema, type Design, type DesignPatch, type DropPart,
  copyDropPart, moveDropPart, removeDropPart, updateDropPart,
} from "@/lib/design";
import { Chips, GroupedOptions } from "./controls/fields";
import DropPartEditor, { KIND_LABEL, NEW_PART } from "./controls/DropPartEditor";

type Props = { design: Design; onChange: (patch: DesignPatch) => void; focusIndex?: number | null };

export default function DropComposer({ design: d, onChange, focusIndex }: Props) {
  const parts = d.drop.parts;
  const setParts = (next: DropPart[]) => onChange({ drop: { parts: next } } as DesignPatch);

  return (
    <section id="sec-drop" style={{ display: "grid", gap: 12 }}>
      <h3>Build it part by part</h3>
      <p className="muted small" style={{ margin: 0 }}>
        Parts hang one below another by default; open Position on any part to hang it from a different part, set it beside another, shift or tilt it, or add a mirrored twin. Each has its own stones: a stone with a halo or petals, strands or a fringe, an open frame, or a bow.
        Pause the 3D view and click a part to jump to it.
      </p>
      <label className="field" htmlFor="drop-preset"><span>Start from a classic</span>
        <select id="drop-preset" value="" onChange={(e) => { const p = DROP_PRESETS[Number(e.target.value)]; if (p) onChange({ name: p.name, drop: { parts: p.parts.map((x) => DropPartSchema.parse(x)) } } as DesignPatch); }}>
          <option value="">Choose…</option>
          <GroupedOptions items={DROP_PRESETS} text={(p) => `${p.name} — ${p.blurb}`} />
        </select>
      </label>

      {parts.map((p, i) => (
        <DropPartEditor key={i} p={p} i={i} count={parts.length} above={parts.slice(0, i)} focused={focusIndex === i}
          set={(x) => setParts(updateDropPart(parts, i, x))}
          onMove={(by) => setParts(moveDropPart(parts, i, by))}
          onCopy={() => setParts(copyDropPart(parts, i))}
          onRemove={() => setParts(removeDropPart(parts, i))} />
      ))}

      <div className="chips" role="group" aria-label="Add a part">
        {DROP_KINDS.map((k) => (
          <button key={k} type="button" className="btn" disabled={parts.length >= 10}
            onClick={() => setParts([...parts, DropPartSchema.parse(NEW_PART[k])])}>+ {KIND_LABEL[k]}</button>
        ))}
      </div>
      {d.type === "earrings" && (
        <Chips name="Top" options={["post", "hook"] as const} value={d.drop.top} fmt={(v) => (v === "post" ? "Stud post" : "French hook")} onPick={(top) => onChange({ drop: { top } } as DesignPatch)} />
      )}
    </section>
  );
}
