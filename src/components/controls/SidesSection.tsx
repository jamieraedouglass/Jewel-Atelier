"use client";

import { SIDE_KINDS, HUG_REASON, canHug } from "@/lib/design";
import { Chips, Range, Toggle, sectionStyle, type SectionProps } from "./fields";

/** side stones beside a ring's centre stone, and the gallery's rose-cuts */
export default function SidesSection({ d, onChange }: SectionProps) {
  const s = d.sides, ring = d.type === "ring", on = s.kind !== "none";
  return (
    <section id="sec-sides" style={sectionStyle}>
      <h3>Side stones</h3>
      <Chips name="Side stones" options={SIDE_KINDS} value={s.kind} onPick={(kind) => onChange({ sides: { kind } })} />
      {on && ring && (
        <Chips name="Side stones sit" options={["level", "band"] as const} value={s.follow}
          fmt={(v) => (v === "level" ? "Up beside the centre" : "Curving with the band, flush")} onPick={(follow) => onChange({ sides: { follow } })} />
      )}
      {on && ring && canHug(s.kind) && <Toggle id="side-hug" checked={s.hug} onChange={(hug) => onChange({ sides: { hug } })}>Hug the centre stone (sized to it, set tight against it)</Toggle>}
      {on && ring && !canHug(s.kind) && <p className="small muted" style={{ margin: 0 }}>{HUG_REASON}</p>}
      {on && ring && s.hug && canHug(s.kind) && (
        <Range id="side-hug-frac" label="How far they wrap" value={s.hugFrac} min={0.4} max={1} step={0.02} format={(n) => `${Math.round(n * 100)}% of the centre's length`} onChange={(hugFrac) => onChange({ sides: { hugFrac } })} />
      )}
      {on && (!s.hug || !ring || !canHug(s.kind)) && <Range id="side-ct" label="Each" value={s.sizeCt} min={0.1} max={1.5} step={0.05} format={(n) => `${n.toFixed(2)} ct`} onChange={(sizeCt) => onChange({ sides: { sizeCt } })} />}
    </section>
  );
}
