"use client";

import { BEAD_GEMS, GEMS, GEM_LOOK, accentsOptional, noAccentsYet, type Design, type DesignPatch } from "@/lib/design";
import ShapeOrder from "../ShapeOrder";
import { Chips, GemSelect, Range, Toggle, colorInputStyle, sectionStyle, type SectionProps } from "./fields";
import ColourGrade from "./ColourGrade";

type Accents = Design["accents"];
type Pattern = Pick<Accents, "shapes" | "turns" | "twins" | "sizes">;
const pattern = (shapes: Accents["shapes"], turns: number[] = [], twins: boolean[] = [], sizes: number[] = []): Pattern => ({ shapes, turns, twins, sizes });

/** one-click patterns; each sets shapes, turns, twins and sizes together so nothing carries over from the last pattern */
const QUICK_PATTERNS: [string, Pattern][] = [
  ["Oval–round", pattern(["oval", "round"])],
  ["Emerald–round–round", pattern(["emerald", "round", "round"])],
  ["Pear–round", pattern(["pear", "round"])],
  ["3 rounds + marquise", pattern(["round", "round", "round", "marquise"])],
  ["3 rounds + marquise turned across", pattern(["round", "round", "round", "marquise"], [0, 0, 0, 90])],
  ["Pears, alternating up and down", pattern(["pear", "pear"], [0, 180])],
  ["Big round, small round, baguette", pattern(["round", "round", "baguette", "round"], [0, 0, 0, 0], [], [2, 1, 1.2, 1])],
  ["All hearts", pattern(["heart"])],
  ["Old-mine round + baguette across", pattern(["old-mine", "baguette"], [0, 90])],
  ["Round + twin baguettes", pattern(["round", "baguette"], [0, 0], [false, true])],
];

/** colour runs for multi-colour lines, e.g. a rainbow sapphire tennis bracelet */
const RAINBOW = ["#d8371f", "#ee6a1c", "#f2a81c", "#efd21f", "#9cc63a", "#2e9e54", "#1f8a9a", "#2456b8", "#4433a6", "#7a3fa6", "#c23c8f", "#e2558a"];
const COLOR_PRESETS: [string, string[]][] = [
  ["Rainbow", RAINBOW],
  ["Rainbow, there and back", [...RAINBOW, ...RAINBOW.slice(1, -1).reverse()]],
  ["Pink ombré", ["#fbd3df", "#f6a9c0", "#ee7ea2", "#e2558a", "#c23c74", "#e2558a", "#ee7ea2", "#f6a9c0"]],
  ["Blue ombré", ["#cfe2f7", "#9cc2ec", "#5f93d8", "#2f62bd", "#1c3f94", "#2f62bd", "#5f93d8", "#9cc2ec"]],
  ["Ruby & diamond", ["#b3062a", "#f4f6fb"]],
  ["Emerald & diamond", ["#0b7a4b", "#f4f6fb"]],
  ["Sapphire & diamond", ["#0c2394", "#f4f6fb"]],
];

/** the largest accent stone a style allows: lines of shaped stones go up to 6 ct, pavé and halos to 1.5 ct */
export const accentMaxCt = (usesShapes: boolean) => (usesShapes ? 6 : 1.5);

/** small stones: halos, pavé, lines, and the repeating pattern along them */
export default function AccentsSection({ d, onChange, usesShapes }: SectionProps & { usesShapes: boolean }) {
  const a = d.accents;
  const setAccents = (p: Partial<Accents>) => onChange({ accents: p } as DesignPatch);
  return (
    <section id="sec-accents" style={sectionStyle}>
      <h3>Accent stones</h3>
      {noAccentsYet(d) && <p className="small muted" style={{ margin: 0 }}>{noAccentsYet(d)}</p>}
      {accentsOptional(d) && !noAccentsYet(d) && (
        <Toggle id="acc-on" checked={a.enabled} onChange={(enabled) => setAccents({ enabled })}>
          Accent stones {a.enabled ? "on" : "off (just the main stone and the metal)"}
        </Toggle>
      )}
      {(a.enabled || !accentsOptional(d)) && (<>
      <div className="row2">
        <label className="field" htmlFor="acc-gem"><span>Gem</span>
          <GemSelect id="acc-gem" value={a.gem} options={GEMS} onPick={(gem) => setAccents({ gem, color: GEM_LOOK[gem].color, glow: 0 })} />
        </label>
        <label className="field" htmlFor="acc-color"><span>Colour</span>
          <input id="acc-color" type="color" value={a.color} onChange={(e) => setAccents({ color: e.target.value })} style={colorInputStyle} />
        </label>
      </div>
      <ColourGrade id="acc" gem={a.gem} look={{ color: a.color, clarity: 0.5, glow: a.glow }} onPick={({ color, glow }) => setAccents({ color, glow })} />
      <Chips name="Accent cut" options={["faceted", "polki", "rose-cut"] as const} value={a.cut} onPick={(cut) => setAccents({ cut })} />
      {!BEAD_GEMS.has(a.gem) && (
        <>
          <span className="small muted">Pattern, repeated along every line of these stones. Add the same shape as often as you like (up to 12 stones per repeat).</span>
          <ShapeOrder chips shapes={a.shapes} turns={a.turns} twins={a.twins} sizes={a.sizes} max={12} onChange={(shapes, turns, twins, sizes) => setAccents({ shapes, turns, twins: twins ?? [], sizes: sizes ?? [] })} />
          <div className="chips" role="group" aria-label="Quick patterns">
            {QUICK_PATTERNS.map(([name, p]) => <button key={name} type="button" className="chip" onClick={() => setAccents(p)}>{name}</button>)}
          </div>
          <span className="small muted">Colours, one stone after another (leave empty for all one colour)</span>
          <div className="chips" role="group" aria-label="Stone colours">
            {a.colors.map((c, i) => (
              <span key={i} className="chip" style={{ display: "inline-flex", gap: 4, alignItems: "center", padding: "2px 4px" }}>
                <input type="color" aria-label={`Colour ${i + 1}`} value={c} style={{ width: 26, height: 22, border: 0, background: "none", padding: 0 }}
                  onChange={(e) => setAccents({ colors: a.colors.map((x, j) => (j === i ? e.target.value : x)) })} />
                <button type="button" className="chip" style={{ padding: "1px 7px" }} aria-label="Remove colour" onClick={() => setAccents({ colors: a.colors.filter((_, j) => j !== i) })}>×</button>
              </span>
            ))}
            <button type="button" className="chip" disabled={a.colors.length >= 60} onClick={() => setAccents({ colors: [...a.colors, a.colors[a.colors.length - 1] ?? a.color] })}>+ colour</button>
          </div>
          <div className="chips" role="group" aria-label="Colour presets">
            {COLOR_PRESETS.map(([n, cols]) => (
              <button key={n} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => setAccents({ colors: cols })}>
                <span style={{ display: "inline-flex", marginRight: 6 }}>{cols.slice(0, 7).map((c, k) => <span key={k} style={{ width: 8, height: 8, borderRadius: 9, background: c, marginLeft: k ? -2 : 0 }} />)}</span>{n}
              </button>
            ))}
            {a.colors.length > 0 && <button type="button" className="chip" onClick={() => setAccents({ colors: [] })}>All one colour</button>}
          </div>
          <span className="small muted">Stone direction</span>
          <Chips name="Stone direction" options={["along", "across", "alternate"] as const} value={a.orientation}
            fmt={(v) => (v === "along" ? "Along the line" : v === "across" ? "Across the line" : "Alternating")} onPick={(orientation) => setAccents({ orientation })} />
        </>
      )}
      <Range id="acc-ct" label="Each" value={a.sizeCt} min={0.005} max={accentMaxCt(usesShapes)} step={0.005} format={(n) => `${n.toFixed(n >= 1 ? 2 : 3)} ct`} onChange={(sizeCt) => setAccents({ sizeCt })} />
      </>)}
    </section>
  );
}
