"use client";

import { Toggle, sectionStyle, type SectionProps } from "./fields";

const ENAMEL_SWATCHES = [["Meenakari green", "#16704c"], ["Ruby red", "#9b1630"], ["Peacock blue", "#1b3f8f"], ["Ivory", "#f3efe6"], ["Rani pink", "#d94f87"], ["Black", "#151515"]];

export default function EnamelSection({ d, onChange }: SectionProps) {
  return (
    <section style={sectionStyle}>
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
  );
}
