"use client";

import { useEffect, useRef, useState } from "react";
import type { Design, DesignPatch, Freeform } from "@/lib/design";
import { compressImage, uid } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";
import FreeformSketch from "./FreeformSketch";

// A unique piece: described in words and/or shown in photos, drawn by the AI as a sketch to look over and change, and
// only then built in 3D. Lines and single stones on the sketch can be dragged to adjust it by hand.

type Props = { design: Design; userId: string | null; onChange: (patch: DesignPatch) => void };

const IDEAS: Record<string, string[]> = {
  necklace: [
    "A Cartier-style festoon: a line of round diamonds with two swags of three baguette rows meeting at a centre ornament",
    "A garland of emerald leaves on a gold vine round the front, with three pear drops",
    "A Mughal-style necklace with a domed gold plate, polki pavé and a ruby drop",
  ],
  earrings: [
    "Chandelier earrings: a round stud, an arc of small rounds, and five graduated briolette drops",
    "A spray of marquise diamond leaves curving up from a pear drop",
    "Openwork gold flower with a ruby centre and a pearl drop",
  ],
  ring: [
    "A leaf mosaic dome: an oval centre stone in a bezel, with rows of marquise emeralds radiating to the edges",
    "A toi-et-moi: a pear and an oval side by side, each in a halo of small rounds",
    "A wide band with three rows of baguettes across the top and milgrain edges",
  ],
};

const same = (a: Freeform, b: Freeform) => JSON.stringify(a) === JSON.stringify(b);

export default function FreeformPanel({ design, userId, onChange }: Props) {
  const type = design.type === "ring" || design.type === "earrings" ? design.type : "necklace";
  const built = design.freeform;
  const [draft, setDraft] = useState<Freeform>(built);
  const [brief, setBrief] = useState("");
  const [change, setChange] = useState("");
  const [files, setFiles] = useState<Blob[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [issues, setIssues] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [handles, setHandles] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  // When the built design changes elsewhere (undo, another tab), the sketch follows it.
  const lastBuilt = useRef(built);
  useEffect(() => { if (!same(lastBuilt.current, built)) { lastBuilt.current = built; setDraft(built); } }, [built]);
  useEffect(() => () => previews.forEach(URL.revokeObjectURL), [previews]);
  const unbuilt = !same(draft, built);

  async function pick(list: FileList | null) {
    if (!list?.length) return;
    try {
      const out = await Promise.all(Array.from(list).filter((f) => f.type.startsWith("image/")).slice(0, 4).map((f) => compressImage(f)));
      previews.forEach(URL.revokeObjectURL);
      setFiles(out); setPreviews(out.map((b) => URL.createObjectURL(b)));
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't read those photos."); }
  }

  async function upload() {
    const supabase = createClient(), batch = uid(), out: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const path = `${userId}/freeform-${batch}-${i}.jpg`;
      const { error: e } = await supabase.storage.from("inspiration").upload(path, files[i], { contentType: "image/jpeg" });
      if (e) throw new Error(e.message);
      out.push(path);
    }
    return out;
  }

  async function draw(kind: "new" | "change") {
    setError(null);
    setBusy(kind === "new" ? (files.length ? "Reading the photos and sketching…" : "Sketching…") : "Redrawing…");
    try {
      const paths = kind === "new" && files.length ? await upload() : [];
      const res = await fetch("/api/freeform", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "new"
          ? { type, prompt: brief.trim() || undefined, paths, bandMm: design.band.widthMm }
          : { type, current: draft, change: change.trim(), bandMm: design.band.widthMm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't draw that.");
      setDraft(json.freeform); setIssues(json.issues ?? []);
      if (kind === "change") setChange("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't draw that.");
    } finally { setBusy(null); }
  }

  // Building also names the piece after the design, unless it has been given a name of its own.
  const build = () => {
    lastBuilt.current = draft;
    const named = !design.name || design.name === "Untitled piece" || design.name === built.name;
    onChange({ freeform: draft, ...(named ? { name: draft.name } : {}) });
  };

  return (
    <section id="sec-freeform" style={{ display: "grid", gap: 12 }}>
      <h3>Unique piece</h3>
      {userId ? (
        <>
          <label className="field" htmlFor="ff-brief">
            <span>Describe the piece, add photos of it, or both</span>
            <textarea id="ff-brief" rows={3} value={brief} onChange={(e) => setBrief(e.target.value)}
              placeholder="Shape, stones and sizes, how it hangs, anything you know: “two swags of three baguette rows, 140 mm across…”" />
          </label>
          <div className="chips">
            {(IDEAS[type] ?? []).map((i) => <button key={i} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => setBrief(i)}>{i}</button>)}
          </div>
          {previews.length > 0 && (
            <div className="chips">{previews.map((u) => <img key={u} src={u} alt="Reference" style={{ height: 64, borderRadius: 6 }} />)}
              <button type="button" className="chip" onClick={() => { setFiles([]); setPreviews([]); }}>Remove photos</button></div>
          )}
          <div className="chips">
            <button type="button" className="btn primary" disabled={!!busy || (!brief.trim() && !files.length)} onClick={() => draw("new")}>{busy ?? "Sketch it"}</button>
            <button type="button" className="btn" disabled={!!busy} onClick={() => photoInput.current?.click()}>{previews.length ? "Change photos" : "Add photos"}</button>
            <input ref={photoInput} type="file" accept="image/*" multiple hidden onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
          </div>
          <p className="small muted" style={{ margin: 0 }}>Sketching takes about a minute (two if it has to fix something). Nothing is built until you choose Build it.</p>
        </>
      ) : <p className="small muted" style={{ margin: 0 }}>Sign in to have a unique piece drawn from a description or photos.</p>}
      {error && <p className="error">{error}</p>}

      <div style={{ display: "grid", gap: 8 }}>
        <div className="chips" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <strong>{draft.name}</strong>
          <span className="small muted">{unbuilt ? "Sketch, not built yet" : "Built"}</span>
        </div>
        <FreeformSketch freeform={draft} type={type} bandMm={design.band.widthMm} onEdit={handles ? setDraft : undefined} />
        {draft.notes && <p className="small" style={{ margin: 0 }}>{draft.notes}</p>}
        {issues.length > 0 && (
          <div className="small" role="status">
            <strong>Still to sort out before casting:</strong>
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{issues.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        )}
        <div className="chips">
          <button type="button" className="btn primary" disabled={!unbuilt} onClick={build}>{unbuilt ? "Build it in 3D" : "Built in 3D"}</button>
          <button type="button" className="chip" aria-pressed={handles} onClick={() => setHandles(!handles)}>{handles ? "Done adjusting" : "Adjust by hand"}</button>
          {unbuilt && <button type="button" className="chip" onClick={() => { setDraft(built); setIssues([]); }}>Back to the built one</button>}
        </div>
        {handles && <p className="small muted" style={{ margin: 0 }}>Drag the round handles to reshape lines, the square ones to move stones.{draft.mirror ? " The left half follows the right." : ""}</p>}
        {userId && (
          <>
            <label className="field" htmlFor="ff-change"><span>What should change?</span>
              <input id="ff-change" value={change} onChange={(e) => setChange(e.target.value)} placeholder="Deeper swags, five rows, bigger leaves near the top…" />
            </label>
            <button type="button" className="btn" disabled={!!busy || !change.trim()} onClick={() => draw("change")}>{busy === "Redrawing…" ? busy : "Redraw the sketch"}</button>
          </>
        )}
      </div>
    </section>
  );
}
