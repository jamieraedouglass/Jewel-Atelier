"use client";

import { useEffect, useState } from "react";
import { setThumbnail } from "@/app/actions";
import type { Design } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import { thumbQueue } from "./gallery/thumbQueue";
import { thumbPath } from "@/lib/thumbs";

/**
 * For a design without a saved picture: wait for the shared thumbnail canvas (ThumbStudio) to draw it,
 * show that picture, and save it so the card has one next time.
 */
export default function LiveThumb({ design, id, userId }: { design: Design; id: string; userId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let url: string | null = null;
    const { picture, cancel } = thumbQueue.request(id, design);
    void picture.then(async (blob) => {
      if (!blob) return;
      url = URL.createObjectURL(blob);
      setSrc(url);
      const path = thumbPath(userId, id);
      const { error } = await createClient().storage.from("thumbnails").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (!error) await setThumbnail(id, path);
    });
    return () => { cancel(); if (url) URL.revokeObjectURL(url); };
    // the picture is of the design as it was when the card appeared
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId]);
  if (src) return <img src={src} alt={design.name} />;
  return <div className="ph" aria-label={`Drawing ${design.name}…`} />;
}
