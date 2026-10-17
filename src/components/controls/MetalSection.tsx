"use client";

import { KARATS, METALS, isGold } from "@/lib/design";
import { Chips, sectionStyle, type SectionProps } from "./fields";

export default function MetalSection({ d, onChange }: SectionProps) {
  return (
    <section id="sec-metal" style={sectionStyle}>
      <h3>Metal</h3>
      <Chips name="Metal" options={METALS} value={d.metal} onPick={(metal) => onChange({ metal })} />
      {isGold(d.metal) && (
        <Chips name="Purity" options={KARATS} value={d.purity.karat as (typeof KARATS)[number]} fmt={(k) => `${k}k`} onPick={(karat) => onChange({ purity: { karat } })} />
      )}
    </section>
  );
}
