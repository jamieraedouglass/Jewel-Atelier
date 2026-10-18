"use client";

import { useState } from "react";
import type { Design } from "@/lib/design";
import { compressImage } from "@/lib/media";

type Setting = "dark" | "light" | "hand";
const SETTING_LABEL: Record<Setting, string> = { dark: "Dark velvet", light: "Ivory", hand: "On a hand" };
const dataUrl = (b: Blob) => new Promise<string>((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(b); });

export default function PhotoStyle({ design, capture, onClose }: { design: Design; capture: () => Promise<Blob | null>; onClose: () => void }) {
  const [setting, setSetting] = useState<Setting>("dark");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function make(s: Setting) {
    setSetting(s); setBusy(true); setError(null);
    try {
      const shot = await capture();
      if (!shot) throw new Error("Couldn't take a picture of the 3D view.");
      const res = await fetch("/api/photoreal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ render: await dataUrl(await compressImage(shot, 1024)), design, setting: s }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Couldn't make the image.");
      setImage(json.image);
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't make the image."); }
    finally { setBusy(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Photo-style image" style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "grid", placeItems: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div className="proposal" style={{ maxWidth: 560, width: "100%", display: "grid", gap: 10, background: "var(--panel, #1a1612)" }} onClick={(e) => e.stopPropagation()}>
        <h4 style={{ margin: 0 }}>Photo-style image</h4>
        <p className="small muted" style={{ margin: 0 }}>Turns the current 3D view into a photo-like picture of the same piece. Turn the piece to the angle you want first. An AI image can drift from the design in small ways, so check it before sending it to a client.</p>
        <div className="chips" role="group" aria-label="Background">
          {(Object.keys(SETTING_LABEL) as Setting[]).map((s) => <button key={s} type="button" className="chip" aria-pressed={setting === s} disabled={busy} onClick={() => make(s)}>{SETTING_LABEL[s]}</button>)}
        </div>
        {busy && <p className="small">Making the image… (up to a minute)</p>}
        {error && <p className="error">{error}</p>}
        {image && <img src={image} alt={`Photo-style image of ${design.name}`} style={{ width: "100%", borderRadius: 8 }} />}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!image && !busy && <button className="btn primary" type="button" onClick={() => make(setting)}>Make the image</button>}
          {image && <a className="btn primary" href={image} download={`${design.name || "design"}-photo.png`}>Download</a>}
          <button className="btn" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
