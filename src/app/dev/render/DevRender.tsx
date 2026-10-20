"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { View } from "@/components/canvas/types";
import { DesignSchema, SHOWCASE, applyPatchLenient, chooseStyle, defaultDesign, showcaseDesign, type Design, type DesignPatch, type PieceType } from "@/lib/design";

const RingCanvas = dynamic(() => import("@/components/RingCanvas"), { ssr: false });
const FreeformSketch = dynamic(() => import("@/components/FreeformSketch"), { ssr: false });
type Recreation = { title: string; type: PieceType; style: string; patch: DesignPatch; base?: Design | null };

declare global {
  interface Window { __design?: Design; __apply?: (r: Recreation) => Design }
}

export default function DevRender() {
  const [design, setDesign] = useState<Design>(defaultDesign());
  const [view, setView] = useState<View>("hero");
  // ?sketch shows a freeform design's sketch beside the 3D view.
  const [sketch, setSketch] = useState(false);
  useEffect(() => {
    const q = new URLSearchParams(location.search), v = q.get("view");
    if (v === "top" || v === "detail" || v === "hero") setView(v);
    setSketch(q.has("sketch"));
    // ?showcase=<name> opens that showcase piece, so a preview link can be shared and reloaded.
    const name = q.get("showcase"), s = name ? SHOWCASE.find((x) => x.name.toLowerCase() === name.toLowerCase()) : null;
    if (s) setDesign(showcaseDesign(s));
    // ?load=<file in public/> opens a saved design JSON, to look at a design before it is saved anywhere.
    const file = q.get("load");
    if (file) fetch(`/${file}`).then((r) => r.json()).then((d) => setDesign(DesignSchema.parse(d))).catch(() => {});
  }, []);
  useEffect(() => {
    window.__design = design;
    window.__apply = (r) => {
      const d = { ...applyPatchLenient(chooseStyle(r.base ?? window.__design ?? defaultDesign(), r.type, r.style), { ...r.patch, type: r.type, style: r.style } as DesignPatch), name: r.title };
      window.__design = d;
      setDesign(d);
      return d;
    };
  }, [design]);
  return (
    <div className="stage" style={{ position: "fixed", inset: 0 }}>
      <RingCanvas design={design} view={view} autoRotate={false} quality="high" />
      {sketch && design.style === "freeform" && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "50%", background: "var(--panel)", padding: 12 }}>
          <FreeformSketch freeform={design.freeform} type={design.type} bandMm={design.band.widthMm} onEdit={() => {}} />
        </div>
      )}
    </div>
  );
}
