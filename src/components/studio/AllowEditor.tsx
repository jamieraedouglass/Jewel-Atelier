"use client";

import { BEAD_GEMS, GEMS, GEM_LOOK, KARATS, METALS, SHAPES, label, varietiesOf } from "@/lib/design";
import { type Allow, type StoneOption, optionLook, optionName } from "@/lib/studio/links";
import { Range, Toggle } from "../controls/fields";
import MultiChips from "../style/MultiChips";

const STONE_OPTIONS: StoneOption[] = GEMS.filter((g) => !BEAD_GEMS.has(g) && g !== "other").flatMap((gem) => [{ gem }, ...varietiesOf(gem).map((v) => ({ gem, grade: v.id }))]);
const keyOf = (o: StoneOption) => `${o.gem}:${o.grade ?? ""}`;

export default function AllowEditor({ allow, onChange, idPrefix = "a" }: { allow: Allow; onChange: (a: Allow) => void; idPrefix?: string }) {
  const set = (p: Partial<Allow>) => onChange({ ...allow, ...p });
  return (
    <>
      <Toggle id={`${idPrefix}-sizes`} checked={allow.sizes} onChange={(sizes) => set({ sizes })}>Sizes (ring size, wrist, length)</Toggle>
      <span className="small muted">Centre stones they can choose (their piece&apos;s own stone is always an option)</span>
      <MultiChips name="Stone options" options={STONE_OPTIONS.map(keyOf)} value={allow.stones.map(keyOf)} max={12}
        fmt={(k) => optionName(STONE_OPTIONS.find((o) => keyOf(o) === k)!)} swatch={(k) => { const o = STONE_OPTIONS.find((x) => keyOf(x) === k)!; return o.grade ? optionLook(o).color : GEM_LOOK[o.gem].color; }}
        onChange={(keys) => set({ stones: keys.map((k) => STONE_OPTIONS.find((o) => keyOf(o) === k)!) })} />
      <span className="small muted">Shapes they can choose</span>
      <MultiChips name="Shape options" options={SHAPES} value={allow.shapes} max={12} fmt={label} onChange={(shapes) => set({ shapes })} />
      <Range id={`${idPrefix}-scale`} label="Stone size" value={Math.round(allow.stoneScale * 100)} min={0} max={50} step={5} format={(n) => (n ? `up to ${n}% bigger or smaller` : "fixed")} onChange={(n) => set({ stoneScale: n / 100 })} />
      <span className="small muted">Metals they can choose</span>
      <MultiChips name="Metal options" options={METALS} value={allow.metals} fmt={label} onChange={(metals) => set({ metals })} />
      <span className="small muted">Karats they can choose</span>
      <MultiChips name="Karat options" options={KARATS.map(String)} value={allow.karats.map(String)} fmt={(k) => `${k}k`} onChange={(ks) => set({ karats: ks.map(Number) })} />
      <Toggle id={`${idPrefix}-chat`} checked={allow.chat} onChange={(chat) => set({ chat })}>Let them ask the AI designer</Toggle>
    </>
  );
}
