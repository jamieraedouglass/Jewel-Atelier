"use client";

import { useEffect, useRef, useState } from "react";
import type { Cutout } from "./canvas/types";

const REFS = [
  { id: "quarter", name: "US quarter", mm: 24.26, hint: "Tap one edge of the quarter, then the opposite edge (straight across the middle)." },
  { id: "penny", name: "US penny", mm: 19.05, hint: "Tap one edge of the penny, then the opposite edge." },
  { id: "rs10", name: "₹10 coin", mm: 27, hint: "Tap one edge of the ₹10 coin, then the opposite edge." },
  { id: "thb5", name: "Thai 5 baht", mm: 24, hint: "Tap one edge of the 5 baht coin, then the opposite edge." },
  { id: "card", name: "Bank or ID card (long side)", mm: 85.6, hint: "Tap the two ends of the card's long side." },
  { id: "custom", name: "Something else I've measured", mm: 0, hint: "Tap the two ends of the thing you measured." },
] as const;

export type TryOnExtra = { title: string; cutout: Cutout };
type Props = {
  cutout: Cutout; front?: Cutout | null; right?: Cutout | null; title: string; onClose: () => void; recut?: (flatten: number) => Cutout | null;
  curve0?: number;
  extras?: TryOnExtra[];
};
type Layer = { pos: { x: number; y: number }; angle: number; flip: boolean; on: boolean };
type Pt = { x: number; y: number };

export default function TryOn({ cutout: whole, front: front0 = null, right = null, title, onClose, recut, extras = [], curve0 = 0.45 }: Props) {
  const [showFront, setShowFront] = useState(!!front0);
  const [ear, setEar] = useState<"left" | "right">("left");
  const [curve, setCurve] = useState(curve0);
  const [front, setFront] = useState<Cutout | null>(front0);
  const recutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (recutTimer.current) clearTimeout(recutTimer.current); }, []);
  const changeCurve = (v: number) => {
    setCurve(v);
    if (!recut) return;
    if (recutTimer.current) clearTimeout(recutTimer.current);
    recutTimer.current = setTimeout(() => { const c = recut(v); if (c) setFront(c); }, 180);
  };
  const cutout = showFront && front ? front : ear === "right" && right ? right : whole;
  const squash = 1;
  const fileIn = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const camIn = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<{ url: string; w: number; h: number } | null>(null);
  const [ref, setRef] = useState<(typeof REFS)[number]>(REFS[0]);
  const [customMm, setCustomMm] = useState("");
  const [pts, setPts] = useState<Pt[]>([]);
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const [angle, setAngle] = useState(0);
  const [flip, setFlip] = useState(false);
  const [shown, setShown] = useState(1);
  const drag = useRef<{ from: Pt; start: Pt; layer: number } | null>(null);
  const [layers, setLayers] = useState<Layer[]>(() => extras.map(() => ({ pos: { x: 0, y: 0 }, angle: 0, flip: false, on: true })));
  const [active, setActive] = useState(-1);
  const setLayer = (i: number, l: Partial<Layer>) => setLayers((cur) => cur.map((x, j) => (j === i ? { ...x, ...l } : x)));
  const activeAngle = active < 0 ? angle : layers[active]?.angle ?? 0;
  const turn = (a: number) => (active < 0 ? setAngle(a) : setLayer(active, { angle: a }));
  const mirror = () => (active < 0 ? setFlip(!flip) : setLayer(active, { flip: !layers[active].flip }));

  const refMm = ref.id === "custom" ? Number(customMm) || 0 : ref.mm;
  const mmPerPhotoPx = pts.length === 2 && refMm > 0 ? refMm / Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : null;
  const placing = !!mmPerPhotoPx;

  useEffect(() => {
    const el = box.current;
    if (!el || !photo) return;
    const ro = new ResizeObserver(() => setShown(el.clientWidth / photo.w));
    ro.observe(el);
    return () => ro.disconnect();
  }, [photo]);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  function load(f: File | undefined) {
    if (!f) return;
    setLoadError(null);
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      setPhoto({ url, w: img.naturalWidth, h: img.naturalHeight }); setPts([]); setPos({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 });
      setLayers((cur) => cur.map((l, i) => ({ ...l, pos: { x: (img.naturalWidth * (i + 2)) / (cur.length + 3), y: img.naturalHeight * 0.35 } })));
    };
    img.onerror = () => { URL.revokeObjectURL(url); setLoadError("That photo couldn't be opened here. Try a JPEG or PNG."); };
    img.src = url;
  }
  const toPhoto = (e: React.PointerEvent): Pt => {
    const r = box.current!.getBoundingClientRect();
    return { x: (e.clientX - r.left) / shown, y: (e.clientY - r.top) / shown };
  };
  function tap(e: React.PointerEvent) {
    if (placing) return;
    const p = toPhoto(e);
    setPts((cur) => (cur.length >= 2 ? [p] : [...cur, p]));
  }

  const pieceW = mmPerPhotoPx ? cutout.widthMm / mmPerPhotoPx : 0, pieceH = mmPerPhotoPx ? (cutout.heightMm * squash) / mmPerPhotoPx : 0;
  const sizeOf = (c: Cutout) => (mmPerPhotoPx ? { w: c.widthMm / mmPerPhotoPx, h: c.heightMm / mmPerPhotoPx } : { w: 0, h: 0 });

  async function savePicture() {
    if (!photo || !mmPerPhotoPx) return;
    const c = document.createElement("canvas");
    c.width = photo.w; c.height = photo.h;
    const ctx = c.getContext("2d")!;
    const loadImg = (u: string) => new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = u; });
    const [bg, fg, ...more] = await Promise.all([photo.url, cutout.url, ...extras.map((x) => x.cutout.url)].map(loadImg));
    ctx.drawImage(bg, 0, 0);
    const draw = (img: HTMLImageElement, at: Pt, deg: number, mirrored: boolean, w: number, h: number) => {
      ctx.save(); ctx.translate(at.x, at.y); ctx.rotate((deg * Math.PI) / 180); if (mirrored) ctx.scale(-1, 1); ctx.drawImage(img, -w / 2, -h / 2, w, h); ctx.restore();
    };
    draw(fg, pos, angle, flip, pieceW, pieceH);
    extras.forEach((x, i) => { const l = layers[i], sz = sizeOf(x.cutout); if (l?.on) draw(more[i], l.pos, l.angle, l.flip, sz.w, sz.h); });
    c.toBlob(async (b) => {
      if (!b) return;
      const file = new File([b], `${title.replace(/[^\w\- ]+/g, "") || "try-on"}-try-on.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: `${title}, true to size` }); return; } catch {} }
      const href = URL.createObjectURL(b);
      const a = document.createElement("a"); a.href = href; a.download = file.name; a.click();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    }, "image/jpeg", 0.92);
  }

  return (
    <div className="tryon" role="dialog" aria-label="Try it on, true to size">
      <div className="tryon-head">
        <strong>Try it on · true size</strong>
        <button type="button" className="chip" onClick={onClose} aria-label="Close">×</button>
      </div>

      {!photo ? (
        <div style={{ display: "grid", gap: 12 }}>
          <p className="small" style={{ margin: 0 }}>
            Take a photo of your hand, ear or neck with a <b>coin or card right next to it</b>, at the same distance from the camera, shot straight on.
            The coin tells the app how big things are in the photo, so the piece appears at its real size.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn primary" onClick={() => camIn.current?.click()}>Take a photo</button>
            <button type="button" className="btn" onClick={() => fileIn.current?.click()}>Choose a photo</button>
          </div>
          <input ref={camIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { load(e.target.files?.[0]); e.target.value = ""; }} />
          {loadError && <p className="error small" role="alert">{loadError}</p>}
          <input ref={fileIn} type="file" accept="image/*" hidden onChange={(e) => load(e.target.files?.[0])} />
          <p className="small muted" style={{ margin: 0 }}>Your photo stays on this device; it isn&apos;t uploaded.</p>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {!placing && (
            <>
              <div className="chips" role="group" aria-label="What's in the photo for scale">
                {REFS.map((r) => <button key={r.id} type="button" className="chip" aria-pressed={ref.id === r.id} onClick={() => setRef(r)}>{r.name}</button>)}
              </div>
              {ref.id === "custom" && (
                <label className="field"><span>Its length in mm</span>
                  <input type="number" min={1} step={0.1} value={customMm} onChange={(e) => setCustomMm(e.target.value)} placeholder="e.g. 50" />
                </label>
              )}
              <p className="small" style={{ margin: 0 }}><b>{pts.length === 0 ? "Step 1." : "Step 2."}</b> {ref.hint}</p>
            </>
          )}
          {placing && <p className="small" style={{ margin: 0 }}>Drag the piece into place. It&apos;s drawn at true size ({cutout.widthMm.toFixed(1)} × {cutout.heightMm.toFixed(1)} mm), so it can&apos;t be resized.</p>}

          <div ref={box} className="tryon-photo" onPointerDown={tap} style={{ aspectRatio: `${photo.w} / ${photo.h}`, cursor: placing ? "default" : "crosshair" }}>
            <img src={photo.url} alt="Your photo" draggable={false} />
            {pts.map((p, i) => <span key={i} className="tryon-dot" style={{ left: p.x * shown, top: p.y * shown }} />)}
            {pts.length === 2 && (
              <svg className="tryon-line" width="100%" height="100%"><line x1={pts[0].x * shown} y1={pts[0].y * shown} x2={pts[1].x * shown} y2={pts[1].y * shown} /></svg>
            )}
            {placing && (
              <img src={cutout.url} alt={title} draggable={false} className="tryon-piece"
                style={{ left: pos.x * shown, top: pos.y * shown, width: pieceW * shown, height: pieceH * shown, transform: `translate(-50%, -50%) rotate(${angle}deg) scaleX(${flip ? -1 : 1})` }}
                onPointerDown={(e) => { e.stopPropagation(); setActive(-1); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { from: toPhoto(e), start: pos, layer: -1 }; }}
                onPointerMove={(e) => { const d = drag.current; if (!d || d.layer !== -1) return; const p = toPhoto(e); setPos({ x: d.start.x + p.x - d.from.x, y: d.start.y + p.y - d.from.y }); }}
                onPointerUp={() => (drag.current = null)} />
            )}
            {placing && extras.map((x, i) => {
              const l = layers[i], sz = sizeOf(x.cutout);
              if (!l?.on) return null;
              return (
                <img key={i} src={x.cutout.url} alt={x.title} draggable={false} className="tryon-piece"
                  style={{ left: l.pos.x * shown, top: l.pos.y * shown, width: sz.w * shown, height: sz.h * shown, transform: `translate(-50%, -50%) rotate(${l.angle}deg) scaleX(${l.flip ? -1 : 1})` }}
                  onPointerDown={(e) => { e.stopPropagation(); setActive(i); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { from: toPhoto(e), start: l.pos, layer: i }; }}
                  onPointerMove={(e) => { const d = drag.current; if (!d || d.layer !== i) return; const p = toPhoto(e); setLayer(i, { pos: { x: d.start.x + p.x - d.from.x, y: d.start.y + p.y - d.from.y } }); }}
                  onPointerUp={() => (drag.current = null)} />
              );
            })}
          </div>

          {placing ? (
            <>
              {extras.length > 0 && (
                <div style={{ display: "grid", gap: 6 }}>
                  <span className="small muted">The set: tap a piece to move or turn it; switch pieces on and off</span>
                  <div className="chips" role="group" aria-label="Pieces in the photo">
                    <button type="button" className="chip" style={{ textTransform: "none" }} aria-pressed={active === -1} onClick={() => setActive(-1)}>{title}</button>
                    {extras.map((x, i) => (
                      <span key={i} style={{ display: "inline-flex", gap: 2 }}>
                        <button type="button" className="chip" style={{ textTransform: "none", opacity: layers[i]?.on ? 1 : 0.5 }} aria-pressed={active === i} onClick={() => { setActive(i); if (!layers[i].on) setLayer(i, { on: true }); }}>{x.title}</button>
                        <button type="button" className="chip" aria-label={layers[i]?.on ? `Hide ${x.title}` : `Show ${x.title}`} onClick={() => setLayer(i, { on: !layers[i].on })}>{layers[i]?.on ? "×" : "+"}</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {right && active < 0 && (
                <div className="chips" role="group" aria-label="Which earring">
                  <button type="button" className="chip" aria-pressed={ear === "left"} onClick={() => setEar("left")}>Left earring</button>
                  <button type="button" className="chip" aria-pressed={ear === "right"} onClick={() => setEar("right")}>Right earring</button>
                </div>
              )}
              {front && showFront && active < 0 && (
                <label className="field"><span>How it curves round · {Math.round(curve * 100)}%</span>
                  <input type="range" min={0.15} max={1} step={0.05} value={curve} onChange={(e) => changeCurve(Number(e.target.value))} />
                </label>
              )}
              {front && active < 0 && (
                <div className="chips" role="group" aria-label="How much of the piece">
                  <button type="button" className="chip" aria-pressed={showFront} onClick={() => setShowFront(true)}>As worn (front of the loop)</button>
                  <button type="button" className="chip" aria-pressed={!showFront} onClick={() => setShowFront(false)}>Whole piece</button>
                </div>
              )}
              <label className="field"><span>Turn {active >= 0 ? extras[active]?.title : extras.length ? title : ""} · {activeAngle}°</span>
                <input type="range" min={-180} max={180} step={1} value={activeAngle} onChange={(e) => turn(Number(e.target.value))} />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={mirror}>Mirror (other ear / hand)</button>
                <button type="button" className="btn" onClick={() => setPts([])}>Re-measure the coin</button>
                <button type="button" className="btn" onClick={() => { setPhoto(null); setPts([]); }}>New photo</button>
                <button type="button" className="btn primary" onClick={savePicture}>Save picture</button>
              </div>
              <p className="small muted" style={{ margin: 0 }}>Most accurate when the coin is right beside the spot and the photo is taken straight on, not at an angle.</p>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              {pts.length > 0 && <button type="button" className="btn" onClick={() => setPts([])}>Start the taps again</button>}
              <button type="button" className="btn" onClick={() => setPhoto(null)}>New photo</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
