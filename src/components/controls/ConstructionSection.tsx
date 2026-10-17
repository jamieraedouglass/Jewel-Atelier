"use client";

import { BANGLE_SIZES, CHAIN_STYLES, NECKLACE_LENGTHS, SETTINGS, type ClaspChoice, type Design, type Use, claspChoices, isSolidBracelet, label, blockedOptions } from "@/lib/design";

const CLASP_LABEL: Record<ClaspChoice, string> = {
  auto: "Usual for this piece", box: "Box clasp", jewelled: "Jewelled box (the design runs onto it)", hidden: "Hidden (stones unbroken)",
  lobster: "Lobster claw", "spring-ring": "Spring ring", toggle: "Toggle",
};
import { Chips, Range, Toggle, sectionStyle, type SectionProps } from "./fields";

/** the controls this section can show; it is hidden when the style uses none of them */
export const CONSTRUCTION_USES: Use[] = ["setting", "halo", "accentTop", "pave", "hoop", "length", "chain", "count", "layers", "wrist", "links", "hang", "clasp"];

const lengthName = (n: number) => NECKLACE_LENGTHS.reduce((a, b) => (Math.abs(b.in - n) < Math.abs(a.in - n) ? b : a)).name;

const haloLabel = (style: string) =>
  style === "half-flower" ? "A half flower on both sides of the stone" : style === "tennis" ? "A halo round every stone" : style === "wide-band" ? "Rows on the edges, gold between" : style === "two-stone" ? "A surround round each stone" : "Halo of accent stones";
const paveLabel = (style: string) =>
  style === "flowers" || style === "posy" ? "A diamond in each flower" : style === "open-bangle" ? "A channel of stones along the bangle" : "Set with stones";
const countLabel = (style: string) =>
  style === "half-flower" ? "Petals" : style === "swirl" ? "Ribbons" : style === "flowers" || style === "posy" ? "Flowers" : style === "tassel" ? "Strands" : style === "payal" ? "Bells" : "Stones";
const countMax = (style: string) => (style === "half-flower" ? 9 : style === "swirl" ? 5 : style === "flowers" || style === "posy" ? 12 : 80);
const layersLabel = (style: string) => (style === "tennis" || style === "wide-band" ? "Rows" : style === "by-the-yard" ? "Times round the neck" : "Rows / strands");

/** setting, halo, pavé, hoop shape, length, chain, counts, rows and wrist or bangle size */
export default function ConstructionSection({ d, onChange, has }: SectionProps & { has: (u: Use) => boolean }) {
  const o = d.options;
  const setOpt = (p: Partial<Design["options"]>) => onChange({ options: p });
  const hoopish = d.style === "hoop" || d.style === "huggie";
  const blocked = blockedOptions(d);
  return (
    <section style={sectionStyle}>
      <h3>Construction</h3>
      {has("hang") && (
        <>
          <span className="small muted">Pendant hangs</span>
          {d.style === "pendant"
            ? <Chips name="Pendant hangs" options={["below", "in-chain"] as const} value={o.hang === "in-chain" ? "in-chain" : "below"}
                fmt={(v) => (v === "below" ? "Hanging from a bail" : "Set into the chain")} onPick={(hang) => setOpt({ hang })} />
            : <Chips name="Pendant hangs" options={["in-chain", "on-chain", "below", "drop"] as const} value={o.hang}
                fmt={(v) => (v === "in-chain" ? "Set into the chain" : v === "on-chain" ? "Sitting just under the chain" : v === "below" ? "Hanging below, in a row" : "Stacked drop, one below another")} onPick={(hang) => setOpt({ hang })} />}
        </>
      )}
      {has("setting") && <Chips name="Setting" options={SETTINGS} value={d.setting.style} onPick={(style) => onChange({ setting: { style } })} />}
      {has("setting") && d.type === "ring" && (
        <Range id="height" label="Height" value={d.setting.height} min={0} max={1} step={0.05} format={(n) => (n < 0.2 ? "Low, seated in shank" : n < 0.6 ? "Medium" : "Tall cathedral")} onChange={(height) => onChange({ setting: { height } })} />
      )}
      {d.style === "half-flower" && (
        <>
          <span className="small muted">Where the flowers sit</span>
          <Chips name="Where the flowers sit" options={["finger", "band"] as const} value={o.flowerPlace}
            fmt={(v) => (v === "finger" ? "At the ends, along the finger" : "At the sides, along the band")} onPick={(flowerPlace) => setOpt({ flowerPlace })} />
        </>
      )}
      {d.style === "deco" && (
        <Range id="deco-dome" label="Top" value={o.decoDome} min={0} max={1} step={0.05}
          format={(n) => (n === 0 ? "Flat (Art Deco plaque)" : n < 0.5 ? "Gently domed" : "Domed (bombé cocktail)")} onChange={(decoDome) => setOpt({ decoDome })} />
      )}
      {d.style === "two-stone" && d.type === "ring" && (
        <>
          <span className="small muted">The two stones</span>
          <Chips name="The two stones" options={blocked.pairTouching ? (["apart"] as const) : (["apart", "touching"] as const)} value={o.pairSpacing}
            fmt={(v) => (v === "apart" ? "A little apart" : "Touching")} onPick={(pairSpacing) => setOpt({ pairSpacing })} />
          {blocked.pairTouching && <p className="small muted" style={{ margin: 0 }}>{blocked.pairTouching.reason}</p>}
        </>
      )}
      {has("halo") && <Toggle id="halo" checked={o.halo} onChange={(halo) => setOpt({ halo })}>{haloLabel(d.style)}</Toggle>}
      {has("accentTop") && <Toggle id="acc-top" checked={o.accentTop} onChange={(accentTop) => setOpt({ accentTop })}>Accent stone at the top</Toggle>}
      {has("pave") && <Toggle id="pave" checked={o.pave} onChange={(pave) => setOpt({ pave })}>{paveLabel(d.style)}</Toggle>}
      {has("pave") && o.pave && hoopish && (
        <>
          <span className="small muted">How far the stones run</span>
          <Chips name="Coverage" options={["front", "half", "full"] as const} value={o.paveCoverage}
            fmt={(v) => (v === "front" ? "Front two-thirds" : v === "half" ? "Bottom half" : "All the way up")} onPick={(paveCoverage) => setOpt({ paveCoverage })} />
          <span className="small muted">Where the stones sit</span>
          <Chips name="Face" options={blocked.hoopInside ? (["front", "outer"] as const) : (["front", "outer", "inner"] as const)} value={o.hoopFace}
            fmt={(v) => (v === "front" ? "Facing out (the side people see)" : v === "outer" ? "Round the outside of the hoop" : "On the inside")} onPick={(hoopFace) => setOpt({ hoopFace })} />
          {blocked.hoopInside && <p className="small muted" style={{ margin: 0 }}>{blocked.hoopInside.reason}</p>}
        </>
      )}
      {d.style === "hoop" && !d.center.none && (
        <Range id="charm-turn" label="Charm faces" value={o.charmTurn} min={-180} max={180} step={5}
          format={(n) => (n === 0 ? "Forward" : Math.abs(n) === 90 ? "Sideways" : `${n}°`)} onChange={(charmTurn) => setOpt({ charmTurn })} />
      )}
      {hoopish && d.type === "earrings" && (
        <Chips name="Hoop shape" options={["round", "oval", "paperclip"] as const} value={o.hoopShape} fmt={(v) => (v === "paperclip" ? "Paperclip (long)" : label(v))} onPick={(hoopShape) => setOpt({ hoopShape })} />
      )}
      {has("hoop") && <Range id="hoop" label="Diameter" value={o.hoopDiameterMm} min={8} max={70} step={1} format={(n) => `${n} mm`} onChange={(hoopDiameterMm) => setOpt({ hoopDiameterMm })} />}
      {has("length") && <Range id="length" label="Length" value={o.lengthIn} min={12} max={40} step={1} format={(n) => `${n}" (${Math.round(n * 2.54)} cm) · ${lengthName(n)}`} onChange={(lengthIn) => setOpt({ lengthIn })} />}
      {has("chain") && <Chips name="Chain" options={CHAIN_STYLES} value={o.chain} onPick={(chain) => setOpt({ chain })} />}
      {has("count") && <Range id="count" label={countLabel(d.style)} value={o.count} min={1} max={countMax(d.style)} step={1} onChange={(count) => setOpt({ count })} />}
      {has("links") && <Chips name="Links" options={["x", "chevron"] as const} value={o.linkStyle} fmt={(v) => (v === "x" ? "X links with pavé" : "Chevrons with stone rows")} onPick={(linkStyle) => setOpt({ linkStyle })} />}
      {has("layers") && <Range id="layers" label={layersLabel(d.style)} value={o.layers} min={1} max={7} step={1} onChange={(layers) => setOpt({ layers })} />}
      {has("clasp") && (
        <>
          <span className="small muted">Clasp</span>
          <Chips name="Clasp" options={claspChoices(d.style)} value={o.clasp} fmt={(v) => CLASP_LABEL[v]} onPick={(clasp) => setOpt({ clasp })} />
        </>
      )}
      {has("wrist") && (isSolidBracelet(d)
        ? <><span className="small muted">Bangle size (Indian)</span><Chips name="Bangle size" options={BANGLE_SIZES} value={o.bangleSize} fmt={(s) => s} onPick={(bangleSize) => setOpt({ bangleSize })} /></>
        : <Range id="wrist" label="Wrist" value={o.wristCm} min={13} max={24} step={0.5} format={(n) => `${n} cm`} onChange={(wristCm) => setOpt({ wristCm })} />)}
    </section>
  );
}
