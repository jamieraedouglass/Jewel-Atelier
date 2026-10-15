"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Design } from "@/lib/design";
import LiveThumb from "./LiveThumb";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false });

/** A gallery picture that turns into the spinning 3D piece while you hover over it. */
export default function HoverSpin({ design, id, userId, thumb }: { design: Design; id: string; userId: string; thumb: string | null }) {
  const [live, setLive] = useState(false);
  return (
    <div style={{ position: "relative" }} onMouseEnter={() => setLive(true)} onMouseLeave={() => setLive(false)}>
      {thumb ? <img src={thumb} alt={design.name} /> : <LiveThumb design={design} id={id} userId={userId} />}
      {live && (
        <div className="ph" style={{ position: "absolute", inset: 0 }}>
          <RingCanvas design={design} autoRotate />
        </div>
      )}
    </div>
  );
}
