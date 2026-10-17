"use client";

export default function PairBar({ unmatched, ear, mirrorPair, onMatched, onEar, onMirror }: {
  unmatched: boolean; ear: "left" | "right"; mirrorPair: boolean;
  onMatched: (matched: boolean) => void; onEar: (ear: "left" | "right") => void; onMirror: (mirror: boolean) => void;
}) {
  return (
    <section className="pairbar" aria-label="The pair">
      <div className="chips" role="group" aria-label="Matching">
        <button type="button" className="chip" aria-pressed={!unmatched} onClick={() => onMatched(true)}>Matching pair</button>
        <button type="button" className="chip" aria-pressed={unmatched} onClick={() => onMatched(false)}>Each earring different</button>
      </div>
      {unmatched ? (
        <>
          <div className="chips" role="group" aria-label="Which earring you're editing">
            <span className="small muted" style={{ alignSelf: "center" }}>Editing</span>
            <button type="button" className="chip" aria-pressed={ear === "left"} onClick={() => onEar("left")}>Left earring</button>
            <button type="button" className="chip" aria-pressed={ear === "right"} onClick={() => onEar("right")}>Right earring</button>
          </div>
          <span className="small muted">Changes go to the {ear} earring only. Metal and karat are shared. Click an earring on the paused piece to switch to it.</span>
        </>
      ) : (
        <>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={mirrorPair} onChange={(e) => onMirror(e.target.checked)} />
            Mirror the second earring (angled stones and side parts face the other way)
          </label>
          <span className="small muted">Every change applies to both earrings.</span>
        </>
      )}
    </section>
  );
}
