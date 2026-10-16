"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { duplicateDesign, saveDesign, setPublic, setThumbnail } from "@/app/actions";
import { describeDesign, type Design } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import type { RingCanvasHandle } from "../canvas/types";

export const fileName = (d: Design) => `${d.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "design"}.png`;

type Opts = {
  initialId: string | null; initialPublic: boolean; userId: string | null;
  designRef: React.MutableRefObject<Design>; canvas: React.MutableRefObject<RingCanvasHandle | null>;
  dirty: boolean; setDirty: (d: boolean) => void; flash: (msg: string) => void; setStatus: (s: string | null) => void;
};

/** saving, copying and sharing the design on screen */
export function useSaving({ initialId, initialPublic, userId, designRef, canvas, dirty, setDirty, flash, setStatus }: Opts) {
  const router = useRouter();
  const [id, setId] = useState(initialId);
  const idRef = useRef(id);
  idRef.current = id;
  const [isPublic, setIsPublic] = useState(initialPublic);
  // one save at a time: a second press (or Save then Share) waits for the first rather than making a second design
  const inFlight = useRef<Promise<string | null> | null>(null);

  /** a picture of the piece for the gallery; a failure here never loses the saved design */
  async function saveThumbnail(designId: string) {
    if (!userId) return;
    try {
      const blob = (await canvas.current?.hero?.()) ?? (await canvas.current?.snapshot());
      if (!blob || blob.size < 2000) return; // nothing drawn yet
      const path = `${userId}/${designId}.jpg`;
      const { error } = await createClient().storage.from("thumbnails").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) console.warn("thumbnail upload failed:", error.message);
      else await setThumbnail(designId, path);
    } catch (e) { console.warn("thumbnail failed", e); }
  }

  async function doSave(): Promise<string | null> {
    const current = idRef.current;
    if (!userId) { router.push(`/login?next=${encodeURIComponent(current ? `/design/${current}` : "/design")}`); return null; }
    setStatus("Saving…");
    const saving = designRef.current;
    let r: { id?: string; error?: string };
    try { r = await saveDesign(current, saving); } catch { r = { error: "Couldn't reach the server. Check your connection and try again." }; }
    if (r.error || !r.id) { setStatus(r.error ?? "Save failed."); return null; }
    const newId = r.id;
    // anything changed while saving is still unsaved
    if (designRef.current === saving) setDirty(false);
    if (!current) {
      setId(newId); idRef.current = newId;
      // move to the design's own address through the router rather than editing browser history directly
      router.replace(`/design/${newId}`, { scroll: false });
    }
    flash("Saved");
    void saveThumbnail(newId);
    return newId;
  }
  function save(): Promise<string | null> {
    if (!inFlight.current) inFlight.current = doSave().finally(() => { inFlight.current = null; });
    return inFlight.current;
  }

  /** links are private until you share one */
  async function shareLink(): Promise<string | null> {
    const current = !idRef.current || dirty ? await save() : idRef.current;
    if (!current) return null;
    if (!isPublic) {
      const r = await setPublic(current, true);
      if (r?.error) { setStatus(r.error); return null; }
      setIsPublic(true);
    }
    return `${window.location.origin}/d/${current}`;
  }

  async function copyLink() {
    const link = await shareLink();
    if (!link) return;
    try { await navigator.clipboard.writeText(link); flash("Link copied. Anyone with it can view."); }
    catch { setStatus(link); }
  }

  async function downloadImage() {
    const blob = await canvas.current?.snapshot("image/png");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName(designRef.current); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** WhatsApp: on phones, share the render itself plus the link; elsewhere open WhatsApp with the link. */
  async function whatsapp() {
    const link = await shareLink();
    if (!link) return;
    const d = designRef.current;
    const text = `${d.name}: ${describeDesign(d)}\n${link}`;
    const blob = await canvas.current?.snapshot("image/png");
    const file = blob ? new File([blob], fileName(d), { type: "image/png" }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch { /* cancelled or unsupported: fall through */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function makePrivate() {
    if (!idRef.current) return;
    const r = await setPublic(idRef.current, false);
    if (r?.error) { setStatus(r.error); return; }
    setIsPublic(false);
    flash("Link turned off");
  }

  async function makeCopy() {
    if (!userId) { router.push("/login"); return; }
    if (idRef.current && dirty && !(await save())) return;
    setStatus("Making a copy…");
    const r = await duplicateDesign(designRef.current);
    if (r.error || !r.id) { setStatus(r.error ?? "Couldn't copy."); return; }
    flash("Copy made. You're editing the copy now.");
    router.push(`/design/${r.id}`);
  }

  return { id, isPublic, save, saveThumbnail, copyLink, downloadImage, whatsapp, makePrivate, makeCopy };
}
