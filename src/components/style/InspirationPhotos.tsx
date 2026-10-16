"use client";

import { useRef } from "react";
import { compressImage, uid } from "@/lib/media";
import { createClient } from "@/lib/supabase/client";

export type Img = { path: string; url: string };

/**
 * Inspiration photos: dropped or chosen, compressed, uploaded to the person's own folder. `onChange` receives the
 * new list and saves it; uploads that overlap build on the latest list, not a stale copy.
 */
export default function InspirationPhotos({ userId, images, latest, onChange, onStatus }: {
  userId: string; images: Img[]; latest: () => Img[]; onChange: (f: (cur: Img[]) => Img[], msg: string) => void; onStatus: (s: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    onStatus("Uploading…");
    const supabase = createClient();
    const added: Img[] = [];
    for (const f of Array.from(files).slice(0, 12 - latest().length)) {
      if (!f.type.startsWith("image/")) continue;
      try {
        const blob = await compressImage(f, 1200);
        const path = `${userId}/${uid()}.jpg`;
        const { error } = await supabase.storage.from("inspiration").upload(path, blob, { contentType: "image/jpeg" });
        if (!error) added.push({ path, url: URL.createObjectURL(blob) });
      } catch { /* skip unreadable files */ }
    }
    onChange((cur) => [...cur, ...added].slice(0, 12), added.length ? `Added ${added.length} photo${added.length > 1 ? "s" : ""}` : "Those files couldn't be read");
  }

  async function remove(path: string) {
    const gone = latest().find((i) => i.path === path);
    if (gone?.url.startsWith("blob:")) URL.revokeObjectURL(gone.url);
    await createClient().storage.from("inspiration").remove([path]);
    onChange((cur) => cur.filter((i) => i.path !== path), "Removed");
  }

  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3>Inspiration photos</h3>
      <div className="dropzone" role="button" tabIndex={0} onClick={() => input.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && input.current?.click()}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}>
        <strong>Drop photos here</strong>
        <span className="muted small">Up to 12 · the designer sees the first 8: jewellery, outfits, interiors, anything with your taste</span>
      </div>
      <input ref={input} id="insp-files" type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
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
  );
}
