"use client";

import { GEM_LOOK, type Gem } from "@/lib/design";
import { GemSelect, Range, Toggle, sectionStyle, type SectionProps } from "./fields";

const FRINGE_GEMS: Gem[] = ["pearl", "coral", "emerald", "ruby", "onyx", "turquoise", "garnet", "amethyst"];

export default function FringeSection({ d, onChange }: SectionProps) {
  return (
    <section id="sec-fringe" style={sectionStyle}>
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
  );
}
