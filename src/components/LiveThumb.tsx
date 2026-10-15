"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { setThumbnail } from "@/app/actions";
import type { Design } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import type { RingCanvasHandle } from "./RingCanvas";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false });

/** For a design without a saved picture: draw it live in the card, then save that picture for next time. */
export default function LiveThumb({ design, id, userId }: { design: Design; id: string; userId: string }) {
  const handle = useRef<RingCanvasHandle | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let done = false;
    const t = setTimeout(async () => {
      const blob = await handle.current?.snapshot().catch(() => null);
      if (!blob || blob.size < 2000 || done) return;
      setSrc(URL.createObjectURL(blob)); // swap the live 3D for a still, so many cards don't keep many 3D views running
      const path = `${userId}/${id}.jpg`;
      const { error } = await createClient().storage.from("thumbnails").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (!error) await setThumbnail(id, path);
    }, 3500);
    return () => { done = true; clearTimeout(t); };
  }, [id, userId]);
  if (src) return <img src={src} alt={design.name} />;
  return <div className="ph" style={{ position: "relative" }}><RingCanvas design={design} autoRotate={false} handle={handle} /></div>;
}
