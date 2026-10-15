"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { Design } from "@/lib/design";
import { VIEW_LABEL, type View } from "./RingCanvas";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false });

export default function RingViewer({ design }: { design: Design }) {
  const [view, setView] = useState<View>("hero");
  return (
    <div style={{ position: "relative", height: "min(70dvh, 640px)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}>
      <RingCanvas design={design} view={view} />
      <div className="chips" style={{ position: "absolute", right: 12, bottom: 12 }}>
        {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
          <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
        ))}
      </div>
    </div>
  );
}
