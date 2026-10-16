"use client";

import { useEffect, useRef, useState } from "react";
import type { CenterStone } from "@/lib/design";
import { compressImage, uid, videoFrames } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

type Analysis = { observations: string; cautions: string[]; confidence: number; sizeBasis: string; pairing?: string | null };
type Props = { userId: string | null; onApply: (stone: Partial<CenterStone>) => void };

export default function StoneUploader({ userId, onApply }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [frames, setFrames] = useState<Blob[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const previewsRef = useRef(previews);
  previewsRef.current = previews;
  useEffect(() => () => previewsRef.current.forEach(URL.revokeObjectURL), []);
  const [carat, setCarat] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ stone: Partial<CenterStone>; analysis: Analysis } | null>(null);

  if (!userId) return <p className="muted">Sign in to upload and analyse your own stones.</p>;

  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setResult(null);
    setBusy("Reading files…");
    try {
      const out: Blob[] = [];
      for (const f of Array.from(files).slice(0, 6)) {
        if (f.type.startsWith("video/")) out.push(...(await videoFrames(f, 4)));
        else if (f.type.startsWith("image/")) out.push(await compressImage(f));
      }
      const kept = out.slice(0, 6);
      previews.forEach(URL.revokeObjectURL);
      setFrames(kept);
      setPreviews(kept.map((b) => URL.createObjectURL(b)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read those files.");
    } finally {
      setBusy(null);
    }
  }

  async function analyse() {
    if (!frames.length) return;
    setError(null);
    setBusy("Uploading…");
    try {
      const supabase = createClient();
      const batch = uid();
      const paths: string[] = [];
      for (let i = 0; i < frames.length; i++) {
        const path = `${userId}/${batch}-${i}.jpg`;
        const { error } = await supabase.storage.from("stones").upload(path, frames[i], { contentType: "image/jpeg" });
        if (error) throw new Error(error.message);
        paths.push(path);
      }
      setBusy("Analysing the stone…");
      const res = await fetch("/api/analyze-stone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paths, carat: carat ? Number(carat) : null, notes: notes || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Analysis failed.");
      setResult(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setBusy(null);
    }
  }

  const s = result?.stone;
  return (
    <>
      <section style={{ display: "grid", gap: 12 }}>
        <h3>Your stone</h3>
        <p className="muted small" style={{ margin: 0 }}>
          Add a few photos or a short video. A finger, coin or ruler in frame helps with size; a carat weight helps more.
        </p>
        <div className="dropzone" role="button" tabIndex={0} onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}>
          <strong>Drop photos or a video</strong>
          <span className="muted small">JPG, PNG or MP4 · up to 6 files (iPhone HEIC photos work in Safari)</span>
        </div>
        <input ref={input} id="stone-files" type="file" accept="image/*,video/*" multiple hidden onChange={(e) => pick(e.target.files)} />
        {previews.length > 0 && (
          <div className="thumbs">{previews.map((u) => <figure key={u}><img src={u} alt="Stone frame" /></figure>)}</div>
        )}
        <div className="row2">
          <label className="field" htmlFor="up-carat">
            <span>Carat (if known)</span>
            <input id="up-carat" type="number" min={0.1} step={0.01} value={carat} onChange={(e) => setCarat(e.target.value)} placeholder="15.24" />
          </label>
        </div>
        <label className="field" htmlFor="up-notes">
          <span>Notes for the analyst</span>
          <textarea id="up-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Seller says Burmese, no heat. Report pending." />
        </label>
        <button className="btn primary" type="button" disabled={!frames.length || !!busy} onClick={analyse}>{busy ?? "Analyse stone"}</button>
        {error && <p className="error">{error}</p>}
      </section>

      {result && s && (
        <section className="proposal">
          <h4>{s.label}</h4>
          <p className="small" style={{ margin: 0 }}>
            {s.gem} · {s.cut} · {s.shape} · {s.lengthMm} × {s.widthMm} mm
            <span className="muted"> (size from {result.analysis.sizeBasis}) · confidence {Math.round(result.analysis.confidence * 100)}%</span>
          </p>
          <p className="small" style={{ margin: 0 }}>{result.analysis.observations}</p>
          {result.analysis.pairing && <p className="small" style={{ margin: 0 }}><b style={{ fontWeight: 500 }}>For you:</b> {result.analysis.pairing}</p>}
          {result.analysis.cautions.length > 0 && (
            <ul className="small muted" style={{ margin: 0, paddingLeft: 18 }}>
              {result.analysis.cautions.map((c) => <li key={c}>{c}</li>)}
            </ul>
          )}
          <button className="btn primary" type="button" onClick={() => onApply(s)}>Put this stone in the ring</button>
        </section>
      )}
    </>
  );
}
