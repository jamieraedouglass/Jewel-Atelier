"use client";

import { useRef, useState } from "react";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import * as THREE from "three";
import type { Design, DesignPatch, Motif } from "@/lib/design";
import { compressImage, uid } from "@/lib/media";
import { motifPreviewSvg } from "@/lib/motifModel";
import { createClient } from "@/lib/supabase/client";

type Props = { design: Design; userId: string | null; onChange: (patch: DesignPatch) => void };

const IDEAS = ["Paisley with a ruby eye and a diamond border", "Peacock with a spread tail of emerald drops", "Lotus with five petals and a polki centre", "Art Deco fan with baguette rays", "Mughal arch with jaali cut-outs"];

/** Read an .svg file: join every <path d>, and work out the drawing's box. No AI involved. */
function parseSvgFile(text: string): Pick<Motif, "path" | "viewBox"> {
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const ds = Array.from(doc.querySelectorAll("path")).map((p) => p.getAttribute("d") ?? "").filter(Boolean);
  if (!ds.length) throw new Error("No <path> found. In Illustrator, convert shapes and text to outlines, then export as SVG.");
  const path = ds.join(" ").replace(/[^MmLlHhVvCcSsQqTtAaZz0-9eE.,+\-\s]/g, " ").replace(/\s+/g, " ").trim();
  const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${path}"/></svg>`);
  const box = new THREE.Box2();
  data.paths.forEach((p) => SVGLoader.createShapes(p).forEach((s) => s.getPoints(32).forEach((pt) => box.expandByPoint(pt))));
  if (box.isEmpty()) throw new Error("That SVG has no closed shapes to use.");
  const size = box.getSize(new THREE.Vector2());
  return { path, viewBox: [box.min.x, box.min.y, Math.max(size.x, 1e-3), Math.max(size.y, 1e-3)] };
}

export default function MotifPanel({ design, userId, onChange }: Props) {
  const mo = design.motif;
  const sketchInput = useRef<HTMLInputElement>(null);
  const svgInput = useRef<HTMLInputElement>(null);
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const setMotif = (p: Partial<Motif>) => onChange({ motif: p });

  async function generate(imagePath?: string) {
    setError(null); setNotes(null);
    setBusy(imagePath ? "Tracing your sketch…" : "Drawing the motif…");
    try {
      const res = await fetch("/api/motif", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: brief || undefined, imagePath, pieceType: `${design.type} (${design.style})` }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't draw that.");
      // keep the size the motif has now (it may have changed while Claude was drawing): send only the drawing
      const { widthMm: _w, thicknessMm: _t, ...drawing } = json.motif;
      void _w; void _t;
      onChange({ motif: drawing, ...(json.enamel ? { enamel: { enabled: true } } : {}) });
      setNotes(json.notes || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draw that.");
    } finally {
      setBusy(null);
    }
  }

  async function traceSketch(files: FileList | null) {
    const f = files?.[0];
    if (!f || !userId) return;
    setBusy("Uploading…");
    try {
      const blob = await compressImage(f, 1400);
      const path = `${userId}/sketch-${uid()}.jpg`;
      const { error } = await createClient().storage.from("stones").upload(path, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      await generate(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      setBusy(null);
    }
  }

  async function importSvg(files: FileList | null) {
    const f = files?.[0];
    if (!f) return;
    setError(null);
    try {
      const { path, viewBox } = parseSvgFile(await f.text());
      // keep stones only if the old ones fit the new drawing's box; otherwise start bare
      setMotif({ name: f.name.replace(/\.svg$/i, ""), path, viewBox, stones: [] });
      setNotes("Imported as drawn. Ask the designer to place stones on it, or leave it as plain gold.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't read that SVG.");
    }
  }

  return (
    <section id="sec-motif" style={{ display: "grid", gap: 12 }}>
      <h3>Custom motif</h3>
      <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 12, alignItems: "center" }}>
        <div aria-label={`Preview of ${mo.name}`} role="img" style={{ width: 96, height: 96, background: "var(--bg)", borderRadius: 10, padding: 6 }}
          dangerouslySetInnerHTML={{ __html: motifPreviewSvg(mo) }} />
        <div style={{ display: "grid", gap: 4 }}>
          <strong>{mo.name}</strong>
          <span className="small muted">{mo.stones.length} stone{mo.stones.length === 1 ? "" : "s"} · {mo.widthMm} mm wide</span>
        </div>
      </div>

      {userId ? (
        <>
          <label className="field" htmlFor="motif-brief">
            <span>Describe a shape</span>
            <textarea id="motif-brief" value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="Peacock with a spread tail, emerald drops on each feather, ruby eye" />
          </label>
          <div className="chips">
            {IDEAS.map((i) => <button key={i} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => setBrief(i)}>{i}</button>)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn primary" disabled={!!busy || !brief.trim()} onClick={() => generate()}>{busy ?? "Draw it"}</button>
            <button type="button" className="btn" disabled={!!busy} onClick={() => sketchInput.current?.click()}>Trace a sketch</button>
            <button type="button" className="btn" disabled={!!busy} onClick={() => svgInput.current?.click()}>Use an SVG file</button>
          </div>
          <input ref={sketchInput} id="motif-sketch" type="file" accept="image/*" hidden onChange={(e) => traceSketch(e.target.files)} />
          <input ref={svgInput} id="motif-svg" type="file" accept=".svg,image/svg+xml" hidden onChange={(e) => importSvg(e.target.files)} />
        </>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>Sign in to draw motifs from a description or a sketch.</p>
      )}
      {notes && <p className="small" style={{ margin: 0 }}>{notes}</p>}
      {error && <p className="error">{error}</p>}

      <div className="row2">
        <label className="field" htmlFor="motif-w"><span>Width · {+mo.widthMm.toFixed(1)} mm</span>
          <input id="motif-w" type="range" min={4} max={120} step={0.5} value={mo.widthMm} onChange={(e) => setMotif({ widthMm: Number(e.target.value) })} />
        </label>
        <label className="field" htmlFor="motif-t"><span>Thickness · {+mo.thicknessMm.toFixed(2)} mm</span>
          <input id="motif-t" type="range" min={0.4} max={6} step={0.1} value={mo.thicknessMm} onChange={(e) => setMotif({ thicknessMm: Number(e.target.value) })} />
        </label>
      </div>
      <div className="chips" role="group" aria-label="Edge">
        {(["smooth", "millegrain", "rope"] as const).map((e) => (
          <button key={e} type="button" className="chip" aria-pressed={mo.edge === e} onClick={() => setMotif({ edge: e })}>{e === "smooth" ? "Smooth edge" : e === "millegrain" ? "Millegrain edge" : "Rope edge"}</button>
        ))}
      </div>
    </section>
  );
}
