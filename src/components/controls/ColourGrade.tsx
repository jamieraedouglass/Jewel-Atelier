"use client";

import { type Gem, matchingVariety, varietiesOf, varietyLook, type Variety } from "@/lib/design";
import { Range } from "./fields";

type Look = { color: string; clarity: number; glow: number };

export default function ColourGrade({ id, gem, look, onPick }: { id: string; gem: Gem; look: Look; onPick: (look: Look, v?: Variety) => void }) {
  const grades = varietiesOf(gem);
  if (!grades.length && !look.glow) return null;
  const current = matchingVariety(gem, look);
  return (
    <>
      {grades.length > 0 && (
        <>
          <span className="small muted">Colour grade{current ? ` · ${current.blurb}` : ""}</span>
          <div className="chips" role="group" aria-label="Colour grade">
            {grades.map((v) => (
              <button key={v.id} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={current?.id === v.id} title={v.blurb} onClick={() => onPick(varietyLook(v), v)}>
                <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 99, background: v.color, marginRight: 6, boxShadow: v.glow ? `0 0 ${2 + v.glow * 6}px ${v.color}` : undefined }} />{v.name}
              </button>
            ))}
          </div>
        </>
      )}
      <Range id={`${id}-glow`} label="Glow" value={look.glow} min={0} max={1} step={0.05}
        format={(n) => (n === 0 ? "None" : n < 0.35 ? "A little" : n < 0.65 ? "Lively" : "Glows from within")} onChange={(glow) => onPick({ ...look, glow })} />
    </>
  );
}
