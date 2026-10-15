"use client";

import { useRef, useState } from "react";
import { saveStyleProfile } from "@/app/actions";
import { compressImage, uid } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

type Img = { path: string; url: string };
type Props = { userId: string; initial: { icons: string[]; notes: string; images: Img[] } };

const ICON_IDEAS = ["Grace Kelly", "Jackie Kennedy", "Carolyn Bessette-Kennedy", "Sofia Richie Grainge", "Kelly Rutherford", "Princess Diana", "Audrey Hepburn", "Zendaya"];

export default function StyleProfileEditor({ userId, initial }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [icons, setIcons] = useState(initial.icons);
  const [iconDraft, setIconDraft] = useState("");
  const [notes, setNotes] = useState(initial.notes);
  const [images, setImages] = useState(initial.images);
  const [status, setStatus] = useState<string | null>(null);

  const addIcon = (name: string) => {
    const n = name.trim();
    if (n && !icons.includes(n) && icons.length < 12) setIcons([...icons, n]);
    setIconDraft("");
  };

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setStatus("Uploading…");
    const supabase = createClient();
    const added: Img[] = [];
    for (const f of Array.from(files).slice(0, 12 - images.length)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const blob = await compressImage(f, 1200);
        const path = `${userId}/${uid()}.jpg`;
        const { error } = await supabase.storage.from("inspiration").upload(path, blob, { contentType: "image/jpeg" });
        if (!error) added.push({ path, url: URL.createObjectURL(blob) });
      } catch { /* skip unreadable files */ }
    }
    const next = [...images, ...added];
    setImages(next);
    await persist(icons, notes, next, added.length ? `Added ${added.length} photo${added.length > 1 ? "s" : ""}` : "Those files couldn't be read");
  }

  async function remove(path: string) {
    const next = images.filter((i) => i.path !== path);
    setImages(next);
    await createClient().storage.from("inspiration").remove([path]);
    await persist(icons, notes, next, "Removed");
  }

  async function persist(ic = icons, no = notes, im = images, msg = "Saved") {
    setStatus("Saving…");
    const r = await saveStyleProfile({ icons: ic, notes: no, image_paths: im.map((i) => i.path) });
    setStatus(r.error ?? msg);
  }

  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section style={{ display: "grid", gap: 12 }}>
        <h3>Inspiration photos</h3>
        <div className="dropzone" role="button" tabIndex={0} onClick={() => input.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
          onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}>
          <strong>Drop photos here</strong>
          <span className="muted small">Up to 12 · the consultant sees the first 8</span>
        </div>
        <input ref={input} id="insp-files" type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
        {images.length > 0 && (
          <div className="thumbs">
            {images.map((i) => (
              <figure key={i.path}>
                <img src={i.url} alt="Inspiration" />
                <button className="btn" style={{ padding: "4px 10px" }} type="button" onClick={() => remove(i.path)} aria-label="Remove photo">×</button>
              </figure>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Style icons <span className="muted small">(optional)</span></h3>
        <div className="chips">
          {icons.map((n) => (
            <button key={n} type="button" className="chip" aria-pressed="true" style={{ textTransform: "none" }} onClick={() => setIcons(icons.filter((x) => x !== n))}>{n} ×</button>
          ))}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); addIcon(iconDraft); }} style={{ display: "flex", gap: 8 }}>
          <input id="icon-input" type="text" value={iconDraft} onChange={(e) => setIconDraft(e.target.value)} placeholder="Add a name" />
          <button className="btn" type="submit">Add</button>
        </form>
        <div className="chips">
          {ICON_IDEAS.filter((n) => !icons.includes(n)).map((n) => (
            <button key={n} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => addIcon(n)}>+ {n}</button>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <h3>Notes</h3>
        <textarea id="style-notes" value={notes} onChange={(e) => setNotes(e.target.value)}
          placeholder="White gold only. Quiet, heirloom-feeling pieces. I love rose-cut diamonds and textured bands; no big halos." />
      </section>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <button className="btn primary" type="button" onClick={() => persist()}>Save profile</button>
        {status && <span className="small muted" role="status">{status}</span>}
      </div>
    </div>
  );
}
