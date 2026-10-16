"use client";

import { useRef, useState } from "react";
import { saveStyleProfile } from "@/app/actions";
import { describeProfile, prefsFromTaste, profileCompleteness, type StylePrefs, type Taste } from "@/lib/style/profile";
import InspirationPhotos, { type Img } from "./style/InspirationPhotos";
import StyleIcons from "./style/StyleIcons";
import PrefsSections from "./style/PrefsSections";
import TasteCard from "./style/TasteCard";

type Props = {
  userId: string; taste: Taste | null;
  initial: { icons: string[]; notes: string; images: Img[]; prefs: StylePrefs; applied: string[]; dismissed: string[]; photoRead: string };
};

/** The style profile: preferences, photos, icons and notes, plus what their designs say, and exactly what the designer reads. */
export default function StyleProfileEditor({ userId, initial, taste }: Props) {
  const [prefs, setPrefs] = useState(initial.prefs);
  const [icons, setIcons] = useState(initial.icons);
  const [notes, setNotes] = useState(initial.notes);
  const [images, setImagesState] = useState(initial.images);
  const [dirty, setDirty] = useState(false);
  // the latest values, for saves that happen after an upload finishes
  const latest = useRef({ prefs, icons, notes, images });
  latest.current = { prefs, icons, notes, images: latest.current.images };
  const [status, setStatus] = useState<string | null>(null);
  // the studio's written read of the photos, which the designer uses instead of the photos themselves
  const [photoRead, setPhotoRead] = useState(initial.photoRead);
  const [reading, setReading] = useState(false);
  async function readPhotos() {
    if (!latest.current.images.length) { setPhotoRead(""); return; }
    setReading(true);
    try {
      const res = await fetch("/api/style/read-photos", { method: "POST" });
      const json = await res.json();
      if (json.read !== undefined) setPhotoRead(json.read);
      if (json.error) setStatus(json.error);
    } catch { setStatus("Couldn't read the photos just now; the designer will look at them directly."); }
    finally { setReading(false); }
  }

  async function persist(msg = "Saved") {
    setStatus("Saving…");
    const cur = latest.current;
    try {
      const r = await saveStyleProfile({ icons: cur.icons, notes: cur.notes, image_paths: cur.images.map((i) => i.path), prefs: cur.prefs });
      setStatus(r.error ?? msg);
      if (!r.error) setDirty(false);
    } catch {
      setStatus("Couldn't save. Check your connection and try again.");
    }
  }
  const edit = <T,>(set: (v: T) => void) => (v: T) => { set(v); setDirty(true); };
  const done = Math.round(profileCompleteness(prefs, icons, notes, images.length) * 100);
  const reads = describeProfile({ prefs, icons, notes, taste, applied: initial.applied, dismissed: initial.dismissed, photoRead, photos: photoRead ? 0 : Math.min(8, images.length) });

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <div style={{ height: 6, borderRadius: 9, background: "var(--line)", overflow: "hidden" }} aria-label={`Profile ${done}% filled in`}>
          <div style={{ width: `${done}%`, height: "100%", background: "var(--accent, #c9a96e)" }} />
        </div>
        <span className="small muted">{done < 100 ? `${done}% filled in. The more the designer knows, the more its suggestions fit.` : "Complete. Suggestions are tuned to all of this."}</span>
      </div>

      <TasteCard taste={taste} onAdopt={() => { if (taste) { setPrefs(prefsFromTaste(taste, prefs)); setDirty(true); setStatus("Filled in from your designs. Check them, then save."); } }} />

      <PrefsSections prefs={prefs} onChange={edit(setPrefs)} />

      <InspirationPhotos userId={userId} images={images} latest={() => latest.current.images}
        onStatus={setStatus}
        onChange={(f, msg) => { latest.current.images = f(latest.current.images); setImagesState(latest.current.images); setPhotoRead(""); void persist(msg).then(readPhotos); }} />

      {images.length > 0 && (
        <section style={{ display: "grid", gap: 6 }}>
          <span className="small muted">How the studio reads your photos</span>
          <p className="small" style={{ margin: 0 }}>{reading ? "Reading your photos…" : photoRead || "Not read yet: the designer will look at the photos directly."}</p>
          {!photoRead && !reading && <div><button type="button" className="btn" onClick={readPhotos}>Read my photos</button></div>}
        </section>
      )}

      <StyleIcons icons={icons} onChange={edit(setIcons)} />

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Notes</h3>
        <textarea id="style-notes" value={notes} onChange={(e) => { setNotes(e.target.value); setDirty(true); }}
          placeholder="White gold only. Quiet, heirloom-feeling pieces. I love rose-cut diamonds and textured bands." />
      </section>

      <details>
        <summary className="small">What the designer reads</summary>
        <pre className="small" style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", margin: "8px 0 0", color: "var(--fg)" }}>{reads || "Nothing yet: fill in anything above."}</pre>
      </details>

      <div style={{ display: "flex", gap: 12, alignItems: "center", position: "sticky", bottom: 0, padding: "10px 0", background: "var(--bg)" }}>
        <button className="btn primary" type="button" onClick={() => persist()}>{dirty ? "Save profile" : "Saved"}</button>
        {status && <span className="small muted" role="status">{status}</span>}
      </div>
    </div>
  );
}
