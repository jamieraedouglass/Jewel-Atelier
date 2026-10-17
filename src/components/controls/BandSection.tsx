"use client";

import { BAND_FINISHES, GEMS, GEM_LOOK, SHAPES, type Design, indianRingSize, label } from "@/lib/design";
import { Chips, GemSelect, Range, sectionStyle, type SectionProps } from "./fields";

export default function BandSection({ d, onChange }: SectionProps) {
  const b = d.band;
  const setBand = (p: Partial<Design["band"]>) => onChange({ band: p });
  return (
    <section style={sectionStyle}>
      <h3>Band</h3>
      <span className="small muted">How the design meets the band</span>
      <Chips name="Profile" options={["raised", "low", "set-in", "flush"] as const} value={b.profile}
        fmt={(v) => (v === "raised" ? "Up on top of the band" : v === "low" ? "Low on the band" : v === "set-in" ? "Set into the band" : "Level with the band (flush)")} onPick={(profile) => setBand({ profile })} />
      {!d.center.none && (
        <>
          <span className="small muted">Under the stone</span>
          <Chips name="Under the stone" options={["none", "peekaboo", "hidden-halo"] as const} value={!d.gallery.roseCut ? "none" : d.gallery.under}
            fmt={(v) => (v === "none" ? "Nothing" : v === "peekaboo" ? "Two peek-a-boo stones" : "A row of stones (hidden halo)")}
            onPick={(v) => onChange({ gallery: v === "none" ? { roseCut: false } : { roseCut: true, under: v } })} />
        </>
      )}
      <span className="small muted">Band shape</span>
      <Chips name="Band shape" options={["classic", "flat", "cigar"] as const} value={b.shape}
        fmt={(v) => (v === "classic" ? "Classic (rounded)" : v === "flat" ? "Flat" : "Cigar band (wide)")}
        onPick={(shape) => setBand({ shape, ...(shape === "cigar" && b.widthMm < 6 ? { widthMm: 8 } : {}) })} />
      <Chips name="Band finish" options={BAND_FINISHES} value={b.finish} onPick={(finish) => setBand({ finish })} />
      <span className="small muted">Stones down the band</span>
      <Chips name="Band stones" options={["none", "shoulders", "half", "full"] as const} value={b.pave}
        fmt={(v) => (v === "none" ? "None" : v === "shoulders" ? "On the shoulders" : v === "half" ? "Half way round" : "All the way round")} onPick={(pave) => setBand({ pave })} />
      {b.pave !== "none" && (
        <>
          <div className="row2">
            <label className="field" htmlFor="bp-gem"><span>Gem</span>
              <GemSelect id="bp-gem" value={b.paveGem} options={GEMS} onPick={(paveGem) => setBand({ paveGem, paveColor: GEM_LOOK[paveGem].color })} />
            </label>
            <label className="field" htmlFor="bp-shape"><span>Shape</span>
              <select id="bp-shape" value={b.paveShape} onChange={(e) => setBand({ paveShape: e.target.value as Design["band"]["paveShape"] })}>
                {SHAPES.map((sh) => <option key={sh} value={sh}>{label(sh)}</option>)}
              </select>
            </label>
          </div>
          <div className="row2">
            <Range id="bp-mm" label="Each, width" value={b.paveMm} min={0.8} max={4} step={0.1} format={(n) => `${n} mm`} onChange={(paveMm) => setBand({ paveMm })} />
            <Range id="bp-rows" label="Rows" value={b.paveRows} min={1} max={4} step={1} onChange={(paveRows) => setBand({ paveRows })} />
          </div>
          <Range id="bp-angle" label="Vine (stones angled left and right)" value={b.paveAngle} min={0} max={80} step={5} format={(n) => (n ? `${n}°` : "Straight line")} onChange={(paveAngle) => setBand({ paveAngle })} />
        </>
      )}
      <div className="row2">
        <Range id="bw" label="Width" value={b.widthMm} min={1.5} max={16} step={0.1} format={(n) => `${n} mm`} onChange={(widthMm) => setBand({ widthMm })} />
        <Range id="size" label="Size" value={d.ringSize} min={3} max={13} step={0.25} format={(n) => `US ${n} · Indian ${indianRingSize(n)}`} onChange={(ringSize) => onChange({ ringSize })} />
      </div>
    </section>
  );
}
