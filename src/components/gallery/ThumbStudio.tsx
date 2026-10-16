"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useSyncExternalStore } from "react";
import type { RingCanvasHandle } from "../canvas/types";
import { thumbQueue } from "./thumbQueue";

const RingCanvas = dynamic(() => import("../RingCanvas"), { ssr: false });

/** a picture smaller than this is an empty frame: nothing drawn yet */
const BLANK_BYTES = 2000;

/**
 * The one canvas that draws every gallery card's picture, one design after another, off screen.
 * Mount it once on a page whose cards use LiveThumb.
 */
export default function ThumbStudio() {
  const job = useSyncExternalStore(thumbQueue.subscribe, thumbQueue.current, () => null);
  const handle = useRef<RingCanvasHandle | null>(null);
  const warm = useRef(false);

  useEffect(() => {
    if (!job) return;
    let done = false, tries = 0;
    let t: ReturnType<typeof setTimeout>;
    const grab = async () => {
      const blob = await handle.current?.snapshot().catch(() => null);
      if (done) return;
      if (blob && blob.size >= BLANK_BYTES) { warm.current = true; thumbQueue.finish(job, blob); return; }
      // the studio light takes a moment to load the first time; after that a frame or two is enough
      if (++tries < 6) t = setTimeout(grab, 1200);
      else thumbQueue.finish(job, null);
    };
    t = setTimeout(grab, warm.current ? 700 : 3500);
    return () => { done = true; clearTimeout(t); };
  }, [job]);

  if (!job) return null;
  return (
    <div aria-hidden style={{ position: "fixed", left: -10000, top: 0, width: 480, height: 480, pointerEvents: "none" }}>
      <RingCanvas lite design={job.design} autoRotate={false} handle={handle} />
    </div>
  );
}
