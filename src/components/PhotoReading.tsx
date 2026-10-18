"use client";

import { useEffect, useState } from "react";

type Mark = { photo?: number; x?: number; y?: number; r?: number };
type Group = { what?: string; shape?: string; cut?: string; color?: string; ratio?: number; sizes_vary?: string; where?: string; marks?: Mark[]; count?: number };
export type Reading = {
  piece?: { type?: string; kind?: string; pair?: boolean; confidence?: number };
  main?: { what?: string; shape?: string; cut?: string; color?: string; size_mm?: string; direction?: string; tip_clock?: number; photo?: number; x?: number; y?: number; w?: number; h?: number };
  groups?: Group[];
  overall?: { length_mm?: number; width_mm?: number; metal?: string; setting?: string };
  structure?: Structure;
  questions?: { question?: string; options?: string[] }[];
};

export type Structure = {
  top_outline?: string; top_length_mm?: number; top_width_mm?: number; top_height_mm?: number; profile?: string;
  stones_down_sides?: boolean; shoulders?: string; band_width_back_mm?: number; band_width_shoulder_mm?: number; gallery?: string; notes?: string;
};
const STRUCT_NUMS: [keyof Structure, string][] = [["top_length_mm", "Top along the finger"], ["top_width_mm", "Top across"], ["top_height_mm", "Height above the finger"], ["band_width_back_mm", "Band at the back"], ["band_width_shoulder_mm", "Band at the shoulders"]];

const COLORS = ["#e8b4d8", "#7fd6a4", "#8ec5ff", "#ffd27a", "#ff9e9e", "#c6a8ff", "#9ee6e6", "#f2f2f2"];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function readingSummary(r: Reading, counts: Record<number, number>, removed: Set<number>, answers: Record<number, string>) {
  const lines: string[] = ["Confirmed reading of the piece (from the person; use these as facts):"];
  if (r.piece?.kind) lines.push(`- Piece: ${r.piece.kind}${r.piece.pair ? " (a pair; build one, mirrored)" : ""}.`);
  if (r.main?.what) lines.push(`- Main stone (it must be in the design as the centre stone): ${r.main.what}${r.main.shape ? `, ${r.main.shape}` : ""}${r.main.cut ? `, ${r.main.cut}` : ""}${r.main.color ? `, ${r.main.color}` : ""}${r.main.size_mm ? `, about ${r.main.size_mm}` : ""}.`);
  if (r.main?.direction && r.main.direction !== "not a ring or round stone") lines.push(`- The main stone points ${r.main.direction}.`);
  const tc = num(r.main?.tip_clock);
  if (tc !== null && tc > 0 && tc <= 12) { const h = Math.floor(tc), mins = Math.round((tc - h) * 60); lines.push(`- On the left piece, the main stone's tip points to about ${h}${mins ? `:${String(mins).padStart(2, "0")}` : ""} o'clock.`); }
  (r.groups ?? []).forEach((g, i) => {
    if (removed.has(i) || !g.what) return;
    const n = counts[i] ?? g.count ?? g.marks?.length ?? 0;
    lines.push(`- ${n} × ${g.what}${g.shape ? ` (${g.shape}${g.cut ? `, ${g.cut}` : ""})` : ""}, each about ${num(g.ratio) ? `${Math.round((g.ratio as number) * 100)}% of the main stone's length` : "small"}${g.sizes_vary ? `; ${g.sizes_vary}` : ""}${g.where ? `; ${g.where}` : ""}.`);
  });
  if (removed.size) lines.push(`- There are no other stones: the person removed ${removed.size} group${removed.size > 1 ? "s" : ""} that isn't there.`);
  if (num(r.overall?.length_mm) && num(r.overall?.width_mm)) lines.push(`- Whole piece about ${r.overall!.length_mm} x ${r.overall!.width_mm} mm.`);
  const st = r.structure;
  if (st) {
    if (st.top_outline) lines.push(`- Top outline: ${st.top_outline}.`);
    if (num(st.top_length_mm) && num(st.top_width_mm)) lines.push(`- Top measures ${st.top_length_mm} mm along the finger x ${st.top_width_mm} mm across.`);
    if (num(st.top_height_mm)) lines.push(`- Top stands ${st.top_height_mm} mm above the finger.`);
    if (st.profile) lines.push(`- Profile: ${st.profile}.`);
    if (typeof st.stones_down_sides === "boolean") lines.push(`- Stones ${st.stones_down_sides ? "carry on down the sides of the top" : "cover only the face of the top"}.`);
    if (st.shoulders) lines.push(`- Shoulders: ${st.shoulders}.`);
    if (num(st.band_width_back_mm)) lines.push(`- Band ${st.band_width_back_mm} mm wide at the back.`);
    if (num(st.band_width_shoulder_mm)) lines.push(`- Band ${st.band_width_shoulder_mm} mm wide at the shoulders.`);
    if (st.gallery) lines.push(`- Underneath: ${st.gallery}.`);
    if (st.notes) lines.push(`- Shape: ${st.notes}.`);
  }
  if (r.overall?.metal) lines.push(`- Metal: ${r.overall.metal}.`);
  if (r.overall?.setting) lines.push(`- Setting: ${r.overall.setting}.`);
  (r.questions ?? []).forEach((q, i) => { if (answers[i] && q.question) lines.push(`- Q: ${q.question} A: ${answers[i]}`); });
  return lines.join("\n");
}

const MISSED = ["Small round diamonds", "Briolette drops", "Pear-shaped diamonds", "Marquise diamonds"];

export default function PhotoReading({ previews, reading, done, busy, onBuild, onCancel }: {
  previews: string[]; reading: Reading | null; done: boolean; busy: boolean;
  onBuild: (summary: string, removed: number[], edited: Reading) => void; onCancel: () => void;
}) {
  const [aspect, setAspect] = useState<Record<number, number>>({});
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, string>>({});
  // Once the reading is done the person can correct the marks: pick a group, tap the photo to add a stone it missed,
  // tap a circle to take one away, or add a group of stones it didn't see at all.
  const [edits, setEdits] = useState<Group[] | null>(null);
  const [shape, setShape] = useState<Structure>({});
  const [active, setActive] = useState<number | null>(null);
  const [naming, setNaming] = useState(false);
  const [custom, setCustom] = useState("");
  const groups = (done && edits) || reading?.groups || [];
  const editable = () => edits ?? (reading?.groups ?? []).map((g) => ({ ...g, marks: [...(g.marks ?? [])] }));
  const structure: Structure | undefined = reading?.structure || Object.keys(shape).length ? { ...(reading?.structure ?? {}), ...shape } : undefined;
  const edited: Reading = { ...(reading ?? {}), groups, ...(structure ? { structure } : {}) };
  const [history, setHistory] = useState<Group[][]>([]);
  const [zoom, setZoom] = useState<number | null>(null);
  useEffect(() => {
    if (zoom === null) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setZoom(null); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [zoom]);
  // Tapping a circle takes that stone away (whichever group it's in); tapping elsewhere adds a stone to the group
  // being marked.
  const tap = (pi: number, e: React.MouseEvent<HTMLDivElement>) => {
    if (!done) return;
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width, y = (e.clientY - box.top) / box.height, a = aspect[pi] ?? 1;
    const before = editable(), next = before.map((g) => ({ ...g, marks: [...(g.marks ?? [])] }));
    let hitGroup = -1, hitMark = -1, best = Infinity;
    next.forEach((g, gi) => {
      if (removed.has(gi)) return;
      g.marks!.forEach((mk, mi) => {
        if ((mk.photo ?? 0) !== pi || num(mk.x) === null || num(mk.y) === null) return;
        const dist = Math.hypot((mk.x as number) - x, ((mk.y as number) - y) * a);
        if (dist < Math.max(0.012, num(mk.r) ?? 0.015) && dist < best) { best = dist; hitGroup = gi; hitMark = mi; }
      });
    });
    let changed = -1;
    if (hitGroup >= 0) { next[hitGroup].marks = next[hitGroup].marks!.filter((_, i) => i !== hitMark); changed = hitGroup; }
    else if (active !== null && next[active]) {
      const rs = next[active].marks!.map((mk) => num(mk.r)).filter((r): r is number => r !== null).sort((p, q) => p - q);
      next[active].marks!.push({ photo: pi, x, y, r: rs.length ? rs[Math.floor(rs.length / 2)] : 0.012 });
      changed = active;
    }
    if (changed < 0) return;
    next[changed].count = next[changed].marks!.length;
    setHistory((h) => [...h.slice(-30), before]);
    setEdits(next);
    setCounts((c) => ({ ...c, [changed]: next[changed].marks!.length }));
  };
  const undo = () => {
    const prev = history[history.length - 1];
    if (!prev) return;
    setHistory((h) => h.slice(0, -1));
    setEdits(prev);
    setCounts((c) => { const n = { ...c }; prev.forEach((g, gi) => { n[gi] = g.marks?.length ?? 0; }); return n; });
  };
  const photoView = (src: string, pi: number, big = false) => {
    const a = aspect[pi] ?? 1;
    return (
      <div style={{ position: "relative", cursor: done ? "crosshair" : undefined, ...(big ? { width: `min(92vw, ${86 / a}vh)` } : {}) }} onClick={(e) => tap(pi, e)}>
        <img src={src} alt={`Photo ${pi + 1}`} style={{ width: "100%", display: "block", borderRadius: 6 }} draggable={false}
          onLoad={(e) => { const im = e.currentTarget; setAspect((x) => ({ ...x, [pi]: im.naturalHeight / Math.max(1, im.naturalWidth) })); }} />
        <svg viewBox={`0 0 1 ${a}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden="true">
          {reading?.main && reading.main.photo === pi && num(reading.main.x) !== null && num(reading.main.w) !== null && (
            <rect x={reading.main.x} y={(reading.main.y ?? 0) * a} width={reading.main.w} height={(reading.main.h ?? 0) * a}
              fill="none" stroke="#fff" strokeWidth={big ? 0.002 : 0.004} strokeDasharray="0.012 0.008" />
          )}
          {groups.map((g, gi) => removed.has(gi) ? null : (g.marks ?? []).filter((mk) => (mk.photo ?? 0) === pi && num(mk.x) !== null && num(mk.y) !== null).map((mk, mi) => (
            <circle key={`${gi}-${mi}`} cx={mk.x} cy={(mk.y as number) * a} r={Math.max(0.006, Math.min(0.08, num(mk.r) ?? 0.015))}
              fill="none" stroke={COLORS[gi % COLORS.length]} strokeWidth={(active === gi ? 0.007 : 0.004) * (big ? 0.6 : 1)} />
          )))}
        </svg>
        {done && !big && (
          <button type="button" className="chip" style={{ position: "absolute", right: 6, top: 6, padding: "1px 8px", background: "rgba(0,0,0,0.6)" }}
            onClick={(e) => { e.stopPropagation(); setZoom(pi); }}>Enlarge</button>
        )}
      </div>
    );
  };
  const addGroup = (what: string) => {
    if (!what.trim()) return;
    const next = editable();
    const shape = /briolette|pear/i.test(what) ? "pear" : /marquise/i.test(what) ? "marquise" : "round";
    next.push({ what: what.trim(), shape, cut: /briolette/i.test(what) ? "briolette" : "faceted", marks: [], count: 0, where: "where marked on the photo" });
    setEdits(next); setActive(next.length - 1); setNaming(false); setCustom("");
  };
  const questions = (reading?.questions ?? []).filter((q) => q.question);
  const unanswered = questions.filter((_, i) => !answers[i]).length;

  return (
    <section className="proposal" style={{ display: "grid", gap: 10 }}>
      <h4 style={{ margin: 0 }}>{done ? "Here's how I read it" : "Reading the photo…"}</h4>
      {reading?.piece?.kind && (
        <p className="small" style={{ margin: 0 }}>
          <b>{reading.piece.kind}</b>
          {num(reading.piece.confidence) !== null && <span className="muted"> · {Math.round((reading.piece.confidence as number) * 100)}% sure</span>}
        </p>
      )}
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: previews.length > 1 ? "1fr 1fr" : "1fr" }}>
        {previews.map((src, pi) => <div key={src}>{photoView(src, pi)}</div>)}
      </div>

      {reading?.main?.what && (
        <p className="small" style={{ margin: 0 }}><span style={{ border: "1px dashed #fff", padding: "0 6px", marginRight: 6 }}>main</span>{reading.main.what}{reading.main.size_mm ? `, about ${reading.main.size_mm}` : ""}</p>
      )}
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
        {groups.map((g, gi) => g.what && (
          <li key={gi} className="small" style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: removed.has(gi) ? 0.45 : 1 }}>
            {done ? (
              <button type="button" className="chip" aria-pressed={active === gi} title="Mark these stones on the photo"
                onClick={() => setActive(active === gi ? null : gi)} style={{ padding: "1px 8px", borderColor: COLORS[gi % COLORS.length], flex: "none" }}>
                {active === gi ? "Done" : "Mark"}
              </button>
            ) : <span style={{ width: 12, height: 12, borderRadius: 12, border: `2px solid ${COLORS[gi % COLORS.length]}`, marginTop: 3, flex: "none" }} />}
            <span style={{ flex: 1 }}>
              {done ? (
                <input type="number" min={0} max={200} aria-label={`How many ${g.what}`} value={counts[gi] ?? g.count ?? g.marks?.length ?? 0}
                  onChange={(e) => setCounts((c) => ({ ...c, [gi]: Math.max(0, Number(e.target.value) || 0) }))} style={{ width: 54, marginRight: 6 }} disabled={removed.has(gi)} />
              ) : <b>{g.count ?? g.marks?.length ?? "…"} × </b>}
              <b>{g.what}</b>
              {num(g.ratio) !== null && <span className="muted">, each ~{Math.round((g.ratio as number) * 100)}% of the main stone</span>}
              {g.sizes_vary && <span className="muted">; {g.sizes_vary}</span>}
              {g.where && <span className="muted">; {g.where}</span>}
            </span>
            {done && (
              <button type="button" className="chip" style={{ padding: "1px 8px" }} onClick={() => setRemoved((s) => { const n = new Set(s); if (n.has(gi)) n.delete(gi); else n.add(gi); return n; })}>
                {removed.has(gi) ? "Put back" : "Not there"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {done && (
        <div style={{ display: "grid", gap: 6 }}>
          <p className="small" style={{ margin: 0 }}>
            {active !== null && groups[active]
              ? <><b>Tap the photo</b> on each {groups[active].what} it missed to add it. Tap any circle to take it away. Tap &ldquo;Done&rdquo; when they&rsquo;re all marked.</>
              : <>Tap any circle it got wrong to take it away. To add stones it missed, tap &ldquo;Mark&rdquo; next to their group first. &ldquo;Enlarge&rdquo; makes the photo bigger.</>}
          </p>
          {history.length > 0 && <button type="button" className="chip" style={{ justifySelf: "start", textTransform: "none" }} onClick={undo}>Undo last change</button>}
          {naming ? (
            <div style={{ display: "grid", gap: 6 }}>
              <span className="small">What did it miss?</span>
              <div className="chips">
                {MISSED.map((w) => <button key={w} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => addGroup(w)}>{w}</button>)}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input type="text" placeholder="Or describe them, e.g. emerald cabochons" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="What it missed" style={{ flex: 1 }} />
                <button type="button" className="btn" disabled={!custom.trim()} onClick={() => addGroup(custom)}>Add</button>
              </div>
            </div>
          ) : (
            <button type="button" className="chip" style={{ justifySelf: "start", textTransform: "none" }} onClick={() => setNaming(true)}>+ Stones it didn&rsquo;t see</button>
          )}
        </div>
      )}

      {zoom !== null && previews[zoom] && (
        <div role="dialog" aria-label="Mark stones on the photo" onClick={() => setZoom(null)}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,8,6,0.92)", display: "grid", placeItems: "center", padding: 12 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ display: "grid", gap: 10, justifyItems: "center", maxHeight: "100%", overflow: "auto" }}>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", alignItems: "center" }}>
              {groups.map((g, gi) => g.what && !removed.has(gi) && (
                <button key={gi} type="button" className="chip" aria-pressed={active === gi} onClick={() => setActive(active === gi ? null : gi)}
                  style={{ borderColor: COLORS[gi % COLORS.length], textTransform: "none" }}>
                  {active === gi ? "✓ " : ""}{g.what} ({counts[gi] ?? g.marks?.length ?? 0})
                </button>
              ))}
              {history.length > 0 && <button type="button" className="chip" style={{ textTransform: "none" }} onClick={undo}>Undo</button>}
              <button type="button" className="btn primary" onClick={() => setZoom(null)}>Done</button>
            </div>
            <span className="small">{active !== null && groups[active] ? `Tap to add ${groups[active].what}. Tap a circle to take it away.` : "Pick a group above to add stones, or tap a circle to take it away."}</span>
            {photoView(previews[zoom], zoom, true)}
            {previews.length > 1 && (
              <div className="chips">
                {previews.map((_, pi) => <button key={pi} type="button" className="chip" aria-pressed={zoom === pi} onClick={() => setZoom(pi)}>Photo {pi + 1}</button>)}
              </div>
            )}
          </div>
        </div>
      )}

      {structure && (
        <div style={{ display: "grid", gap: 6 }}>
          <span className="small"><b>Shape</b> <span className="muted">(from all the photos; fix any measurement)</span></span>
          <p className="small" style={{ margin: 0 }}>
            {[structure.top_outline, structure.profile, typeof structure.stones_down_sides === "boolean" ? (structure.stones_down_sides ? "stones carry on down the sides" : "stones only on the face") : null, structure.shoulders ? `shoulders: ${structure.shoulders}` : null, structure.gallery ? `underneath: ${structure.gallery}` : null].filter(Boolean).join(" · ")}
          </p>
          {done && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              {STRUCT_NUMS.map(([k, label]) => (
                <label key={k} className="small" style={{ display: "grid", gap: 2 }}>
                  {label} (mm)
                  <input type="number" step={0.1} min={0} value={num(structure[k]) ?? ""} placeholder="?"
                    onChange={(e) => setShape((x) => ({ ...x, [k]: e.target.value === "" ? undefined : Number(e.target.value) }))} />
                </label>
              ))}
            </div>
          )}
          {structure.notes && <p className="small muted" style={{ margin: 0 }}>{structure.notes}</p>}
        </div>
      )}

      {reading?.overall && (num(reading.overall.length_mm) !== null || reading.overall.metal) && (
        <p className="small muted" style={{ margin: 0 }}>
          {num(reading.overall.length_mm) !== null && num(reading.overall.width_mm) !== null ? `About ${reading.overall.length_mm} × ${reading.overall.width_mm} mm` : ""}
          {reading.overall.metal ? ` · ${reading.overall.metal}` : ""}{reading.overall.setting ? ` · ${reading.overall.setting}` : ""}
        </p>
      )}

      {done && questions.length > 0 && (
        <div style={{ display: "grid", gap: 8 }}>
          <span className="small"><b>A few questions so it comes out right:</b></span>
          {questions.map((q, qi) => (
            <div key={qi} style={{ display: "grid", gap: 4 }}>
              <span className="small">{q.question}</span>
              <div className="chips" role="group" aria-label={q.question}>
                {(q.options ?? []).map((o) => <button key={o} type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={answers[qi] === o} onClick={() => setAnswers((a) => ({ ...a, [qi]: o }))}>{o}</button>)}
              </div>
              <input type="text" placeholder="Or type your answer" value={answers[qi] && !(q.options ?? []).includes(answers[qi]) ? answers[qi] : ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [qi]: e.target.value }))} aria-label={`Your answer: ${q.question}`} />
            </div>
          ))}
        </div>
      )}

      {done && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn primary" type="button" disabled={busy} onClick={() => onBuild(readingSummary(edited, counts, removed, answers), [...removed], edited)}>
            {unanswered ? `Build it in 3D (${unanswered} unanswered)` : "Looks right: build it in 3D"}
          </button>
          <button className="btn" type="button" disabled={busy} onClick={onCancel}>Start over</button>
          <span className="small muted">Fix any count, tap &ldquo;Mark&rdquo; to add stones it missed, or &ldquo;Not there&rdquo; first.</span>
        </div>
      )}
    </section>
  );
}
