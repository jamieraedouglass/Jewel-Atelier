"use client";

import { useEffect, useRef, useState } from "react";
import { applyPatchLenient, chooseStyle, type Design, type DesignPatch, type PieceType } from "@/lib/design";
import { compressImage, uid } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

type Result = { title: string; type: PieceType; style: string; patch: DesignPatch; description: string; notModelled: string[]; analysis?: string; base?: Design | null; score?: number | null; differences?: string[] };
type Props = {
  userId: string | null; design: Design; onReplace: (d: Design) => void;
  capture?: () => Promise<Blob | null>;
};
const CHECKS = 3;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dataUrl = (b: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });

export default function PhotoToDesign({ userId, design, onReplace, capture }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<Blob[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach(URL.revokeObjectURL), []);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [best, setBest] = useState<{ score: number; round: number; differences: string[] } | null>(null);

  if (!userId) return <p className="muted">Sign in to recreate a piece from a photo.</p>;

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    setError(null); setResult(null);
    try {
      const out = await Promise.all(Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, 4).map((f) => compressImage(f)));
      previews.forEach(URL.revokeObjectURL);
      setFiles(out);
      setPreviews(out.map((b) => URL.createObjectURL(b)));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read those photos."); }
  }

  async function recreate() {
    setError(null);
    setBusy("Uploading…");
    try {
      const supabase = createClient();
      const batch = uid(), paths: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const path = `${userId}/piece-${batch}-${i}.jpg`;
        const { error } = await supabase.storage.from("inspiration").upload(path, files[i], { contentType: "image/jpeg" });
        if (error) throw new Error(error.message);
        paths.push(path);
      }
      setBusy("Studying the piece… (up to a minute)");
      const res = await fetch("/api/from-photo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths, notes: notes || undefined }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't recreate the piece.");
      setResult(json); setBest(null);
      const first: Result = json;
      let built = apply(first, first.base ?? design);
      const builds: { design: Design; result: Result; score: number | null; differences: string[] }[] = [{ design: built, result: first, score: null, differences: [] }];
      for (let round = 1; capture && round <= CHECKS; round++) {
        setBusy(`Comparing the 3D build with your photo (check ${round} of ${CHECKS})…`);
        await wait(2500);
        const shot = await capture();
        if (!shot) break;
        const render = await dataUrl(await compressImage(shot));
        const r2 = await fetch("/api/from-photo/refine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paths, notes: notes || undefined, design: built, render, round }) });
        const j2: Result = await r2.json();
        if (!r2.ok) break;
        const last = builds[builds.length - 1];
        last.score = j2.score ?? null; last.differences = j2.differences ?? [];
        if ((j2.score ?? 0) >= 9 || round === CHECKS) break;
        built = apply(j2, built);
        builds.push({ design: built, result: j2, score: null, differences: [] });
      }
      const scored = builds.filter((b) => b.score !== null);
      if (scored.length) {
        const top = scored.reduce((a, b) => ((b.score ?? 0) > (a.score ?? 0) ? b : a));
        onReplace(top.design);
        setResult({ ...top.result, analysis: first.analysis });
        setBest({ score: top.score ?? 0, round: builds.indexOf(top), differences: top.differences });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't recreate the piece.");
    } finally { setBusy(null); }
  }

  function apply(r: Result, from: Design) {
    const d = { ...applyPatchLenient(chooseStyle(from, r.type, r.style), { ...r.patch, type: r.type, style: r.style } as DesignPatch), name: r.title };
    onReplace(d);
    return d;
  }

  return (
    <>
      <section style={{ display: "grid", gap: 12 }}>
        <h3>Recreate a piece from a photo</h3>
        <p className="muted small" style={{ margin: 0 }}>
          A photo of something your jeweller has made, a screenshot or a sketch. It&apos;s rebuilt in 3D with real parts, so you can then change any stone, size, metal or layout.
        </p>
        <div className="dropzone" role="button" tabIndex={0} onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}>
          <strong>Drop a photo of the piece</strong>
          <span className="muted small">JPG or PNG · up to 4 photos of the same piece: from the top, the side and at an angle give the closest result</span>
        </div>
        <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => pick(e.target.files)} />
        {previews.length > 0 && <div className="thumbs">{previews.map((u) => <figure key={u}><img src={u} alt="The piece" /></figure>)}</div>}
        <label className="field" htmlFor="piece-notes">
          <span>Notes (optional)</span>
          <textarea id="piece-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What the photo can't show: size, stones, how high the top is, what the band looks like…" />
        </label>
        <button className="btn primary" type="button" disabled={!files.length || !!busy} onClick={recreate}>{busy ?? "Recreate in 3D"}</button>
        {error && <p className="error">{error}</p>}
      </section>
      {result && (
        <section className="proposal">
          <h4>{result.title}</h4>
          {best && <p className="small" style={{ margin: 0 }}>Closest match: <b>{best.score}/10</b> ({best.round === 0 ? "the first build" : `after check ${best.round}`}).</p>}
          {result.analysis && (
            <details>
              <summary className="small">How the piece was read</summary>
              <p className="small muted" style={{ margin: "6px 0 0", whiteSpace: "pre-line" }}>{result.analysis}</p>
            </details>
          )}
          {best && best.differences.length > 0 && (
            <>
              <span className="small muted">Still different from the photo (say these in Ask the designer, or add them to Notes and recreate):</span>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{best.differences.map((n) => <li key={n}>{n}</li>)}</ul>
            </>
          )}
          <p className="small" style={{ margin: 0 }}>{result.description}</p>
          {result.notModelled.length > 0 && (
            <>
              <span className="small muted">Not in the 3D model — tell the karigar:</span>
              <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>{result.notModelled.map((n) => <li key={n}>{n}</li>)}</ul>
            </>
          )}
          <p className="small muted" style={{ margin: 0 }}>It&apos;s now in the 3D view. Open the Design tab to change anything, or click a part of the paused piece.</p>
          <button className="btn" type="button" onClick={() => apply(result, result.base ?? design)}>Start over from this photo</button>
        </section>
      )}
    </>
  );
}
