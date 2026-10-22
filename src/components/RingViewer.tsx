"use client";

import dynamic from "next/dynamic";
import { useRef, useState } from "react";
import { type Design, wornCurve } from "@/lib/design";
import { type Cutout, type RingCanvasHandle, VIEW_LABEL, type View } from "./canvas/types";
import TryOn from "./TryOn";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false });

// A design to look at (a shared link, the studio), with its views and "Try it on" on the viewer's own photo.
export default function RingViewer({ design }: { design: Design }) {
  const [view, setView] = useState<View>("hero");
  const canvas = useRef<RingCanvasHandle | null>(null);
  const [tryOn, setTryOn] = useState<{ whole: Cutout; front: Cutout | null; right: Cutout | null } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  function openTryOn() {
    const loop = ["bracelet", "necklace", "anklet"].includes(design.type);
    const whole = canvas.current?.cutout?.("whole");
    if (!whole) { setNote("Give the 3D view a moment to load, then try again."); return; }
    setNote(null);
    setTryOn({
      whole,
      front: loop ? canvas.current?.cutout?.("front", "left", wornCurve(design)) ?? null : null,
      right: design.type === "earrings" ? canvas.current?.cutout?.("whole", "right") ?? null : null,
    });
  }
  return (
    <div style={{ position: "relative", height: "min(70dvh, 640px)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--line)" }}>
      <RingCanvas handle={canvas} design={design} view={view} />
      <div className="chips" style={{ position: "absolute", left: 12, bottom: 12 }}>
        <button type="button" className="chip" onClick={openTryOn}>Try it on</button>
        {note && <span className="small muted" role="status">{note}</span>}
      </div>
      <div className="chips" style={{ position: "absolute", right: 12, bottom: 12 }}>
        {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
          <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
        ))}
      </div>
      {tryOn && <TryOn cutout={tryOn.whole} front={tryOn.front} right={tryOn.right} title={design.name} curve0={wornCurve(design)} onClose={() => setTryOn(null)}
        recut={(flatten) => canvas.current?.cutout?.("front", "left", flatten) ?? null} />}
    </div>
  );
}
