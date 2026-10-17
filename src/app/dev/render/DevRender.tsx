"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { applyPatchLenient, chooseStyle, defaultDesign, type Design, type DesignPatch, type PieceType } from "@/lib/design";

const RingCanvas = dynamic(() => import("@/components/RingCanvas"), { ssr: false });
type Recreation = { title: string; type: PieceType; style: string; patch: DesignPatch };

declare global {
  interface Window { __design?: Design; __apply?: (r: Recreation) => Design }
}

export default function DevRender() {
  const [design, setDesign] = useState<Design>(defaultDesign());
  useEffect(() => {
    window.__design = design;
    window.__apply = (r) => {
      const d = { ...applyPatchLenient(chooseStyle(window.__design ?? defaultDesign(), r.type, r.style), { ...r.patch, type: r.type, style: r.style } as DesignPatch), name: r.title };
      window.__design = d;
      setDesign(d);
      return d;
    };
  }, [design]);
  return (
    <div className="stage" style={{ position: "fixed", inset: 0 }}>
      <RingCanvas design={design} autoRotate={false} quality="high" />
    </div>
  );
}
