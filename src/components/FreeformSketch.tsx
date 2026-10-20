"use client";

import { useMemo, useRef, useState } from "react";
import type { Freeform } from "@/lib/design";
import { layoutFreeform } from "@/lib/freeform/layout";
import { outlineFn } from "@/lib/ringModel";

// The sketch of a freeform design: a flat drawing at true proportions with its measurements, drawn from the same
// layout the 3D model is built from. With `onEdit`, the points of its lines and its single stones can be dragged.

type Props = { freeform: Freeform; type: string; bandMm?: number; onEdit?: (f: Freeform) => void };
type Handle = { kind: "path"; path: number; point: number } | { kind: "stone"; part: number } | { kind: "link"; part: number; end: "a" | "b" };

const GOLD = "#c9a54a";
const r1 = (n: number) => Math.round(n * 10) / 10;

export default function FreeformSketch({ freeform, type, bandMm = 2.5, onEdit }: Props) {
  const lay = useMemo(() => layoutFreeform(freeform), [freeform]);
  const svg = useRef<SVGSVGElement>(null);
  const [drag, setDrag] = useState<Handle | null>(null);
  const b = lay.bounds;
  const pad = Math.max(6, (b.maxX - b.minX) * 0.08);
  const top = type === "necklace" ? Math.min(b.minY, -4) : type === "earrings" ? Math.min(b.minY, -3) : Math.min(b.minY, -bandMm);
  const vb = { x: b.minX - pad, y: top - pad, w: b.maxX - b.minX + pad * 2, h: Math.max(b.maxY, type === "ring" ? bandMm : 0) - top + pad * 2 + 6 };
  const k = vb.w / 600;

  const toDrawing = (e: React.PointerEvent) => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [r1(p.x), r1(p.y)] as const;
  };
  const move = (e: React.PointerEvent) => {
    if (!drag || !onEdit) return;
    const p = toDrawing(e);
    if (!p) return;
    const x = freeform.mirror ? Math.max(0, p[0]) : p[0];
    if (drag.kind === "path") {
      const paths = freeform.paths.map((pa, i) => i !== drag.path ? pa : { ...pa, points: pa.points.map((q, j) => (j === drag.point ? (q.length > 2 ? [x, p[1], q[2]] : [x, p[1]]) as typeof q : q)) });
      onEdit({ ...freeform, paths });
    } else {
      const parts = freeform.parts.map((pt, i) => {
        if (i !== drag.part) return pt;
        if (pt.kind === "stone") return { ...pt, at: (pt.at.length > 2 ? [x, p[1], pt.at[2]] : [x, p[1]]) as typeof pt.at };
        if (pt.kind === "link" && drag.kind === "link") return { ...pt, [drag.end]: [x, p[1]] };
        return pt;
      });
      onEdit({ ...freeform, parts });
    }
  };

  const stoneOutline = (s: (typeof lay.stones)[number]) => {
    const fn = outlineFn(s.shape, s.L, s.W), c = Math.cos(s.angle), si = Math.sin(s.angle);
    return Array.from({ length: s.big ? 48 : 16 }, (_, i) => {
      const [w, l] = fn(i / (s.big ? 48 : 16));
      return `${r1(s.x + l * c - w * si)},${r1(s.y + l * si + w * c)}`;
    }).join(" ");
  };
  const ring = (pts: { x: number; y: number }[]) => `M${pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" L")} Z`;

  return (
    <div className="ff-sketch" style={{ background: "var(--raised)", borderRadius: "var(--radius)", padding: 8 }}>
      <svg ref={svg} viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} style={{ width: "100%", height: "auto", display: "block", touchAction: drag ? "none" : "auto" }}
        role="img" aria-label={`Sketch of ${freeform.name}`} onPointerMove={move} onPointerUp={() => setDrag(null)} onPointerLeave={() => setDrag(null)}>
        {/* What it's worn from. */}
        {type === "necklace" && freeform.neckline.kind !== "none" && (freeform.neckline.kind === "stones"
          ? Array.from({ length: freeform.neckline.rows }, (_, row) => {
              const sz = freeform.neckline.sizeMm, step = sz + 0.18, y = row * (sz + 0.3), n = Math.ceil(vb.w / step);
              return Array.from({ length: n }, (_, i) => <circle key={`n${row}-${i}`} cx={vb.x + (i + 0.5) * step} cy={y} r={sz / 2} fill={freeform.neckline.color} fillOpacity={0.8} stroke="var(--fg)" strokeOpacity={0.5} strokeWidth={k * 0.6} />);
            })
          : <line x1={vb.x} x2={vb.x + vb.w} y1={0} y2={0} stroke="var(--muted)" strokeWidth={k * 1.2} strokeDasharray={`${k * 6} ${k * 4}`} />)}
        {type === "earrings" && <circle cx={0} cy={1.5} r={1.8} fill="none" stroke="var(--muted)" strokeWidth={k * 1.2} />}
        {type === "ring" && <rect x={vb.x} width={vb.w} y={-bandMm / 2} height={bandMm} fill={GOLD} opacity={0.25} />}
        {lay.plates.map((p, i) => (
          <path key={`p${i}`} d={[ring(p.outline), ...p.holes.map(ring)].join(" ")} fillRule="evenodd" fill={GOLD} fillOpacity={0.45} stroke={GOLD} strokeWidth={k * 1.2} />
        ))}
        {lay.wires.map((w, i) => (
          <polyline key={`w${i}`} points={w.pts.map((p) => `${r1(p.x)},${r1(p.y)}`).join(" ")} fill="none" stroke={GOLD} strokeOpacity={w.rail ? 0.5 : 0.95}
            strokeWidth={Math.max(k, w.r * 2)} strokeLinecap="round" strokeDasharray={w.finish === "milgrain" ? `${w.r * 0.8} ${w.r * 0.7}` : undefined} />
        ))}
        {lay.links.map((l, i) => (
          <line key={`l${i}`} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={GOLD} strokeWidth={0.9} strokeDasharray={l.a.distanceTo(l.b) > 8 ? "1.4 0.8" : undefined} />
        ))}
        {lay.stones.map((s, i) => (
          <polygon key={`s${i}`} points={stoneOutline(s)} fill={s.color} fillOpacity={0.8} stroke="var(--fg)" strokeOpacity={0.7} strokeWidth={k * (s.big ? 1.1 : 0.6)} />
        ))}
        {/* Handles for reshaping: points of the lines, and single stones and links. */}
        {onEdit && freeform.paths.map((pa, i) => pa.points.map((q, j) => (
          <circle key={`h${i}-${j}`} cx={q[0]} cy={q[1]} r={k * 7} fill="var(--accent)" fillOpacity={0.35} stroke="var(--accent)" strokeWidth={k * 1.5}
            style={{ cursor: "grab" }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ kind: "path", path: i, point: j }); }}>
            <title>{`${pa.id}, point ${j + 1}: (${q[0]}, ${q[1]}) mm`}</title>
          </circle>
        )))}
        {onEdit && freeform.parts.map((pt, i) => pt.kind === "stone" ? (
          <rect key={`hs${i}`} x={pt.at[0] - k * 7} y={pt.at[1] - k * 7} width={k * 14} height={k * 14} fill="var(--accent)" fillOpacity={0.35} stroke="var(--accent)" strokeWidth={k * 1.5}
            style={{ cursor: "grab" }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ kind: "stone", part: i }); }}>
            <title>{`${pt.shape} ${pt.gem}, ${pt.lengthMm} × ${pt.widthMm} mm`}</title>
          </rect>
        ) : pt.kind === "link" ? (["a", "b"] as const).map((end) => (
          <circle key={`hl${i}${end}`} cx={pt[end][0]} cy={pt[end][1]} r={k * 5} fill="var(--accent)" fillOpacity={0.25} stroke="var(--accent)" strokeWidth={k}
            style={{ cursor: "grab" }} onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDrag({ kind: "link", part: i, end }); }} />
        )) : null)}
        {/* Measurements: overall width and length, and a 10 mm bar. */}
        <g fontSize={k * 13} fill="var(--muted)" style={{ fontVariantNumeric: "tabular-nums" }}>
          <text x={(b.minX + b.maxX) / 2} y={vb.y + vb.h - k * 6} textAnchor="middle">{`${r1(b.maxX - b.minX)} mm across · ${r1(b.maxY - Math.min(0, b.minY))} mm long`}</text>
          <line x1={vb.x + k * 10} x2={vb.x + k * 10 + 10} y1={vb.y + k * 12} y2={vb.y + k * 12} stroke="var(--muted)" strokeWidth={k * 2} />
          <text x={vb.x + k * 10 + 12} y={vb.y + k * 16}>10 mm</text>
        </g>
      </svg>
    </div>
  );
}
