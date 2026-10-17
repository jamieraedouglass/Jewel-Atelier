"use client";

import MotifPanel from "./MotifPanel";
import DropComposer from "./DropComposer";
import FramesEditor from "./FramesEditor";
import { useState } from "react";
import { SHOWCASE, SHOWCASE_CATEGORIES, STYLES, TYPES, TYPE_LABEL, type Design, type DesignPatch, type ShowcaseCategory, type Use, categoryFor, chooseStyle, showcaseDesign, showcaseIn, styleMeta } from "@/lib/design";
import { Chips } from "./controls/fields";
import { BRAND } from "@/lib/brand";
import CenterStoneSection from "./controls/CenterStoneSection";
import ExtraStonesSection from "./controls/ExtraStonesSection";
import AccentsSection from "./controls/AccentsSection";
import FringeSection from "./controls/FringeSection";
import EnamelSection from "./controls/EnamelSection";
import ConstructionSection, { CONSTRUCTION_USES } from "./controls/ConstructionSection";
import SidesSection from "./controls/SidesSection";
import BandSection from "./controls/BandSection";
import MetalSection from "./controls/MetalSection";

type Props = { design: Design; userId: string | null; onChange: (patch: DesignPatch) => void; onReplace: (d: Design) => void; dropFocus?: number | null };

export default function DesignControls({ design: d, userId, onChange, onReplace, dropFocus }: Props) {
  const meta = styleMeta(d.type, d.style);
  const has = (u: Use) => meta.uses.includes(u);
  const section = { d, onChange };
  const [category, setCategory] = useState<ShowcaseCategory>(() => (BRAND.showcaseCategory === "kothari" ? "kothari" : categoryFor(d.type)));

  return (
    <>
      <section style={{ display: "grid", gap: 10 }}>
        <span className="small muted" style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>Start from</span>
        <Chips name="Showcase category" options={SHOWCASE_CATEGORIES.map((c) => c.id)} value={category} fmt={(id) => SHOWCASE_CATEGORIES.find((c) => c.id === id)!.label} onPick={setCategory} />
        <label className="field" htmlFor="showcase">
          <select id="showcase" aria-label="Showcase piece" value="" onChange={(e) => {
            const s = SHOWCASE[Number(e.target.value)];
            if (s) onReplace(showcaseDesign(s, d));
          }}>
            <option value="">Choose a showcase piece ({showcaseIn(category).length})…</option>
            {TYPES.map((t) => {
              const list = showcaseIn(category).filter(({ entry }) => entry.type === t);
              if (!list.length) return null;
              const opts = list.map(({ entry, index }) => <option key={entry.name} value={index}>{entry.name}</option>);
              return category === "kothari" || category === "more" ? <optgroup key={t} label={TYPE_LABEL[t]}>{opts}</optgroup> : opts;
            })}
          </select>
        </label>
        <label className="field" htmlFor="design-name">
          <span>Name</span>
          <input id="design-name" type="text" value={d.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value })} />
        </label>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h3>Piece</h3>
        <Chips name="Piece type" options={TYPES} value={d.type} fmt={(t) => TYPE_LABEL[t]} onPick={(t) => onReplace(chooseStyle(d, t))} />
        <Chips name="Style" options={Object.keys(STYLES[d.type])} value={d.style} fmt={(s) => STYLES[d.type][s].label} onPick={(s) => onReplace(chooseStyle(d, d.type, s))} />
        <p className="muted small" style={{ margin: 0 }}>{meta.blurb}</p>
      </section>

      {has("motif") && <MotifPanel design={d} userId={userId} onChange={onChange} />}
      {has("frames") && <FramesEditor design={d} onChange={onChange} />}
      {has("drop") && <DropComposer design={d} onChange={onChange} focusIndex={dropFocus} />}
      {has("center") && <CenterStoneSection {...section} />}
      {has("extraStones") && <ExtraStonesSection {...section} />}
      {(has("accents") || (has("halo") && d.options.halo) || (has("pave") && d.options.pave) || (has("accentTop") && d.options.accentTop)) && <AccentsSection {...section} usesShapes={has("accentShapes")} />}
      {has("fringe") && <FringeSection {...section} />}
      {has("enamel") && <EnamelSection {...section} />}
      {CONSTRUCTION_USES.some(has) && <ConstructionSection {...section} has={has} />}
      {has("sides") && <SidesSection {...section} />}
      {has("band") && <BandSection {...section} />}
      <MetalSection {...section} />
    </>
  );
}
