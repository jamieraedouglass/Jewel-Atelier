"use client";

import { useState } from "react";

type Mark = { photo?: number; x?: number; y?: number; r?: number };
type Group = { what?: string; shape?: string; cut?: string; color?: string; ratio?: number; sizes_vary?: string; where?: string; marks?: Mark[]; count?: number };
export type Reading = {
  piece?: { type?: string; kind?: string; pair?: boolean; confidence?: number };
  main?: { what?: string; shape?: string; cut?: string; color?: string; size_mm?: string; direction?: string; photo?: number; x?: number; y?: number; w?: number; h?: number };
  groups?: Group[];
  overall?: { length_mm?: number; width_mm?: number; metal?: string; setting?: string };
  questions?: { question?: string; options?: string[] }[];
};

const COLORS = ["#e8b4d8", "#7fd6a4", "#8ec5ff", "#ffd27a", "#ff9e9e", "#c6a8ff", "#9ee6e6", "#f2f2f2"];
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function readingSummary(r: Reading, counts: Record<number, number>, removed: Set<number>, answers: Record<number, string>) {
  const lines: string[] = ["Confirmed reading of the piece (from the person; use these as facts):"];
  if (r.piece?.kind) lines.push(`- Piece: ${r.piece.kind}${r.piece.pair ? " (a pair; build one, mirrored)" : ""}.`);
  if (r.main?.what) lines.push(`- Main stone: ${r.main.what}${r.main.size_mm ? `, about ${r.main.size_mm}` : ""}.`);
  if (r.main?.direction && r.main.direction !== "not a ring or round stone") lines.push(`- The main stone points ${r.main.direction}.`);
  (r.groups ?? []).forEach((g, i) => {
    if (removed.has(i) || !g.what) return;
    const n = counts[i] ?? g.count ?? g.marks?.length ?? 0;
    lines.push(`- ${n} × ${g.what}${g.shape ? ` (${g.shape}${g.cut ? `, ${g.cut}` : ""})` : ""}, each about ${num(g.ratio) ? `${Math.round((g.ratio as number) * 100)}% of the main stone's length` : "small"}${g.sizes_vary ? `; ${g.sizes_vary}` : ""}${g.where ? `; ${g.where}` : ""}.`);
  });
  if (removed.size) lines.push(`- There are no other stones: the person removed ${removed.size} group${removed.size > 1 ? "s" : ""} that isn't there.`);
  if (num(r.overall?.length_mm) && num(r.overall?.width_mm)) lines.push(`- Whole piece about ${r.overall!.length_mm} x ${r.overall!.width_mm} mm.`);
  if (r.overall?.metal) lines.push(`- Metal: ${r.overall.metal}.`);
  if (r.overall?.setting) lines.push(`- Setting: ${r.overall.setting}.`);
  (r.questions ?? []).forEach((q, i) => { if (answers[i] && q.question) lines.push(`- Q: ${q.question} A: ${answers[i]}`); });
  return lines.join("\n");
}

export default function PhotoReading({ previews, reading, done, busy, onBuild, onCancel }: {
  previews: string[]; reading: Reading | null; done: boolean; busy: boolean;
  onBuild: (summary: string) => void; onCancel: () => void;
}) {
  const [aspect, setAspect] = useState<Record<number, number>>({});
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [removed, setRemoved] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const groups = reading?.groups ?? [];
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
        {previews.map((src, pi) => {
          const a = aspect[pi] ?? 1;
          return (
            <div key={src} style={{ position: "relative" }}>
              <img src={src} alt={`Photo ${pi + 1}`} style={{ width: "100%", display: "block", borderRadius: 6 }}
                onLoad={(e) => { const im = e.currentTarget; setAspect((x) => ({ ...x, [pi]: im.naturalHeight / Math.max(1, im.naturalWidth) })); }} />
              <svg viewBox={`0 0 1 ${a}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} aria-hidden="true">
                {reading?.main && reading.main.photo === pi && num(reading.main.x) !== null && num(reading.main.w) !== null && (
                  <rect x={reading.main.x} y={(reading.main.y ?? 0) * a} width={reading.main.w} height={(reading.main.h ?? 0) * a}
                    fill="none" stroke="#fff" strokeWidth={0.004} strokeDasharray="0.012 0.008" />
                )}
                {groups.map((g, gi) => removed.has(gi) ? null : (g.marks ?? []).filter((mk) => (mk.photo ?? 0) === pi && num(mk.x) !== null && num(mk.y) !== null).map((mk, mi) => (
                  <circle key={`${gi}-${mi}`} cx={mk.x} cy={(mk.y as number) * a} r={Math.max(0.006, Math.min(0.08, num(mk.r) ?? 0.015))}
                    fill="none" stroke={COLORS[gi % COLORS.length]} strokeWidth={0.004} />
                )))}
              </svg>
            </div>
          );
        })}
      </div>

      {reading?.main?.what && (
        <p className="small" style={{ margin: 0 }}><span style={{ border: "1px dashed #fff", padding: "0 6px", marginRight: 6 }}>main</span>{reading.main.what}{reading.main.size_mm ? `, about ${reading.main.size_mm}` : ""}</p>
      )}
      <ul style={{ margin: 0, paddingLeft: 0, listStyle: "none", display: "grid", gap: 6 }}>
        {groups.map((g, gi) => g.what && (
          <li key={gi} className="small" style={{ display: "flex", gap: 8, alignItems: "flex-start", opacity: removed.has(gi) ? 0.45 : 1 }}>
            <span style={{ width: 12, height: 12, borderRadius: 12, border: `2px solid ${COLORS[gi % COLORS.length]}`, marginTop: 3, flex: "none" }} />
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
          <button className="btn primary" type="button" disabled={busy} onClick={() => onBuild(readingSummary(reading ?? {}, counts, removed, answers))}>
            {unanswered ? `Build it in 3D (${unanswered} unanswered)` : "Looks right: build it in 3D"}
          </button>
          <button className="btn" type="button" disabled={busy} onClick={onCancel}>Start over</button>
          <span className="small muted">Fix any count or tap &ldquo;Not there&rdquo; first.</span>
        </div>
      )}
    </section>
  );
}
