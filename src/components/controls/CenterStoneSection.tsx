"use client";

import { useEffect, useState } from "react";
import {
  CUTS, DIAMOND_GRADES, GEMS, GEM_LOOK, SHAPES, STAR_RAYS, type Design, canReproportion, estimateDims, gemLabel, inclusionWords, proportionPresets, reproportion, stoneRatio,
} from "@/lib/design";
import { Chips, GemSelect, Range, Toggle, colorInputStyle, sectionStyle, type SectionProps } from "./fields";
import ColourGrade from "./ColourGrade";

/** typical crown (or dome) height as a share of width, by cut, when there is no carat weight to work from */
const DOME_SHARE: Record<Design["center"]["cut"], number> = { cabochon: 0.45, "rose-cut": 0.3, polki: 0.07, faceted: 0.14, briolette: 0.14, bead: 0.5, carved: 0.4 };

/** the main (centre) stone: gem, carat, cut, shape, size, colour and angle */
export default function CenterStoneSection({ d, onChange }: SectionProps) {
  const c = d.center;
  const setCenter = (p: Partial<Design["center"]>) => onChange({ center: p });
  const ratio = canReproportion(c.shape) ? stoneRatio(c) : 1;

  // the carat box keeps what was typed ("0", "0.") until it is a usable weight; outside changes still show up
  const [caratText, setCaratText] = useState(c.carat?.toString() ?? "");
  useEffect(() => {
    const typed = Number(caratText);
    const typedValid = caratText.trim() !== "" && typed > 0;
    if (c.carat !== null ? c.carat !== typed : typedValid) setCaratText(c.carat?.toString() ?? "");
    // only react to the design changing, not to typing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.carat]);
  function setCarat(v: string) {
    setCaratText(v);
    const ct = Number(v);
    // a new weight keeps the stone's chosen proportions (a long oval stays long)
    if (v.trim() !== "" && Number.isFinite(ct) && ct > 0) setCenter({ carat: ct, ...estimateDims(c.gem, c.cut, c.shape, ct, ratio) });
    else if (c.carat !== null) setCenter({ carat: null });
  }

  return (
    <section id="sec-center" style={sectionStyle}>
      <h3>{d.type === "ring" ? "Centre stone" : "Main stone"}</h3>
      <Toggle id="no-main" checked={c.none} onChange={(none) => setCenter({ none })}>
        {d.type === "ring" ? "No centre stone (plain band)" : d.style === "hoop" ? "No charm (plain hoops)" : "No main stone"}
      </Toggle>
      {!c.none && (<>
        <p className="muted small" style={{ margin: 0 }}>{c.label}</p>
        <div className="row2">
          <label className="field" htmlFor="gem"><span>Gem</span>
            <GemSelect id="gem" value={c.gem} options={GEMS} onPick={(gem) => setCenter({ gem, ...GEM_LOOK[gem], label: gemLabel(gem), colorGrade: null })} />
          </label>
          <label className="field" htmlFor="carat"><span>Carat</span>
            <input id="carat" type="number" min={0.01} max={200} step={0.01} value={caratText} placeholder="e.g. 15.24" onChange={(e) => setCarat(e.target.value)} />
          </label>
        </div>
        <Chips name="Cut" options={CUTS} value={c.cut} onPick={(cut) => setCenter({ cut, ...(c.carat ? estimateDims(c.gem, cut, c.shape, c.carat, ratio) : { domeMm: Math.round(c.widthMm * DOME_SHARE[cut] * 10) / 10 }) })} />
        <Chips name="Shape" options={SHAPES} value={c.shape} onPick={(shape) => setCenter({ shape, ...(c.carat ? estimateDims(c.gem, c.cut, shape, c.carat) : {}) })} />
        {canReproportion(c.shape) && (
          <>
            <Range id="ratio" label={c.carat ? "Proportions (same carat)" : "Proportions"} value={ratio} min={0.6} max={2.6} step={0.01}
              format={(n) => `${n.toFixed(2)} : 1 (${n < 1 ? "wider than long" : n < 1.15 ? "nearly square" : "length to width"})`}
              onChange={(r) => setCenter(reproportion(c, r))} />
            <div className="chips" role="group" aria-label="Quick proportions">
              {proportionPresets(c.shape).map(([name, r]) => (
                <button key={name} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={Math.abs(ratio - r) < 0.02} onClick={() => setCenter(reproportion(c, r))}>
                  {name} · {r.toFixed(2)}
                </button>
              ))}
            </div>
          </>
        )}
        <div className="row2">
          <Range id="len" label="Length" value={c.lengthMm} min={1} max={40} step={0.1} format={(n) => `${n} mm`} onChange={(lengthMm) => setCenter({ lengthMm })} />
          <Range id="wid" label="Width" value={c.widthMm} min={1} max={40} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => setCenter({ widthMm })} />
        </div>
        <div className="row2">
          <Range id="dome" label={c.cut === "cabochon" ? "Dome" : "Crown"} value={c.domeMm} min={0.2} max={12} step={0.1} format={(n) => `${n} mm`} onChange={(domeMm) => setCenter({ domeMm })} />
          <Range id="clar" label="Transparency" value={c.clarity} min={0} max={1} step={0.05} format={(n) => `${Math.round(n * 100)}%`} onChange={(clarity) => setCenter({ clarity })} />
        </div>
        <div className="row2">
          <label className="field" htmlFor="color"><span>Colour</span>
            <input id="color" type="color" value={c.color} onChange={(e) => setCenter({ color: e.target.value, colorGrade: null })} style={colorInputStyle} />
          </label>
          <Range id="angle" label="Angle" value={c.rotation} min={-180} max={180} step={5} format={(n) => `${n}°`} onChange={(rotation) => setCenter({ rotation })} />
        </div>
        <ColourGrade id="center" gem={c.gem} look={c} onPick={(look, v) => setCenter({ ...look, ...(v ? { label: `${v.name} ${gemLabel(c.gem).toLowerCase()}` } : {}) })} />
        {c.gem === "diamond" && (
          <div style={{ display: "grid", gap: 6 }}>
            <span className="small muted">Diamond colour</span>
            <div className="chips" role="group" aria-label="Diamond colour">
              {DIAMOND_GRADES.map((g) => (
                <button key={g.id} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={c.colorGrade === g.id} onClick={() => setCenter({ color: g.color, colorGrade: g.id })}>
                  <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: g.color, marginRight: 6, border: "1px solid var(--line)" }} />{g.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <Range id="incl" label="Inclusions" value={c.inclusions} min={0} max={1} step={0.05} format={(n) => inclusionWords(n)} onChange={(inclusions) => setCenter({ inclusions })} />
        {c.cut !== "bead" && (
          <div style={{ display: "grid", gap: 6 }}>
            <Chips name="Effect" options={["none", "star", "cats-eye"] as const} value={c.phenomenon} fmt={(p) => (p === "none" ? "None" : p === "star" ? "Star" : "Cat's eye")}
              // a star or cat's eye only shows on a cabochon
              onPick={(phenomenon) => setCenter(phenomenon === "none" || c.cut === "cabochon" || c.cut === "carved" ? { phenomenon } : { phenomenon, cut: "cabochon", domeMm: Math.round(c.widthMm * DOME_SHARE.cabochon * 10) / 10 })} />
            {c.phenomenon === "star" && <Chips name="Star rays" options={STAR_RAYS} value={c.rays} fmt={(n) => `${n} rays`} onPick={(rays) => setCenter({ rays })} />}
          </div>
        )}
      </>)}
    </section>
  );
}
