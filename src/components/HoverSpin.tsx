"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Design } from "@/lib/design";
import LiveThumb from "./LiveThumb";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false });

/** the card spinning now; starting another stops it, so the gallery never holds more than one live 3D view */
let stopActive: (() => void) | null = null;

/** A gallery picture that turns into the spinning 3D piece while you hover over it. */
export default function HoverSpin({ design, id, userId, thumb }: { design: Design; id: string; userId: string; thumb: string | null }) {
  const [live, setLive] = useState(false);
  const start = () => {
    if (stopActive) stopActive();
    const stop = () => setLive(false);
    stopActive = stop;
    setLive(true);
  };
  const end = () => setLive(false);
  useEffect(() => () => { if (live) stopActive = null; }, [live]);
  return (
    <div style={{ position: "relative" }} onMouseEnter={start} onMouseLeave={end}>
      {thumb ? <img src={thumb} alt={design.name} /> : <LiveThumb design={design} id={id} userId={userId} />}
      {live && (
        <div className="ph" style={{ position: "absolute", inset: 0 }}>
          <RingCanvas lite design={design} autoRotate />
        </div>
      )}
    </div>
  );
}
