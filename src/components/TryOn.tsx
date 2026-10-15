"use client";

import { useEffect, useRef, useState } from "react";
import type { Cutout } from "./RingCanvas";

/** Things of known size people usually have to hand. */
const REFS = [
  { id: "quarter", name: "US quarter", mm: 24.26, hint: "Tap one edge of the quarter, then the opposite edge (straight across the middle)." },
  { id: "penny", name: "US penny", mm: 19.05, hint: "Tap one edge of the penny, then the opposite edge." },
  { id: "rs10", name: "₹10 coin", mm: 27, hint: "Tap one edge of the ₹10 coin, then the opposite edge." },
  { id: "card", name: "Bank or ID card (long side)", mm: 85.6, hint: "Tap the two ends of the card's long side." },
  { id: "custom", name: "Something else I've measured", mm: 0, hint: "Tap the two ends of the thing you measured." },
] as const;

type Props = { cutout: Cutout; title: string; onClose: () => void };
type Pt = { x: number; y: number };

/**
 * Try a piece on a real photo at true size. A coin or card in the photo sets the scale (mm per pixel);
 * the piece is then drawn at exactly that scale, and you can move and turn it, but not resize it.
 */
export default function TryOn({ cutout, title, onClose }: Props) {
  const fileIn = useRef<HTMLInputElement>(null);
  const camIn = useRef<HTMLInputElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [photo, setPhoto] = useState<{ url: string; w: number; h: number } | null>(null);
  const [ref, setRef] = useState<(typeof REFS)[number]>(REFS[0]);
  const [customMm, setCustomMm] = useState("");
  const [pts, setPts] = useState<Pt[]>([]); // in photo pixels
  const [pos, setPos] = useState<Pt>({ x: 0, y: 0 });
  const [angle, setAngle] = useState(0);
  const [flip, setFlip] = useState(false);
  const [shown, setShown] = useState(1); // displayed px per photo px
  const drag = useRef<{ from: Pt; start: Pt } | null>(null);

  const refMm = ref.id === "custom" ? Number(customMm) || 0 : ref.mm;
  const mmPerPhotoPx = pts.length === 2 && refMm > 0 ? refMm / Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y) : null;
  const placing = !!mmPerPhotoPx;

  // keep track of how big the photo is drawn
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
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { setPhoto({ url, w: img.naturalWidth, h: img.naturalHeight }); setPts([]); setPos({ x: img.naturalWidth / 2, y: img.naturalHeight / 2 }); };
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

  // the piece's size in photo pixels
  const pieceW = mmPerPhotoPx ? cutout.widthMm / mmPerPhotoPx : 0, pieceH = mmPerPhotoPx ? cutout.heightMm / mmPerPhotoPx : 0;

  async function savePicture() {
    if (!photo || !mmPerPhotoPx) return;
    const c = document.createElement("canvas");
    c.width = photo.w; c.height = photo.h;
    const ctx = c.getContext("2d")!;
    const [bg, fg] = await Promise.all([photo.url, cutout.url].map((u) => new Promise<HTMLImageElement>((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; })));
    ctx.drawImage(bg, 0, 0);
    ctx.translate(pos.x, pos.y); ctx.rotate((angle * Math.PI) / 180); if (flip) ctx.scale(-1, 1);
    ctx.drawImage(fg, -pieceW / 2, -pieceH / 2, pieceW, pieceH);
    c.toBlob(async (b) => {
      if (!b) return;
      const file = new File([b], `${title.replace(/[^\w\- ]+/g, "") || "try-on"}-try-on.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file], text: `${title}, true to size` }); return; } catch { /* fall through */ } }
      const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = file.name; a.click();
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
          <input ref={camIn} type="file" accept="image/*" capture="environment" hidden onChange={(e) => load(e.target.files?.[0])} />
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
                onPointerDown={(e) => { e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { from: toPhoto(e), start: pos }; }}
                onPointerMove={(e) => { const d = drag.current; if (!d) return; const p = toPhoto(e); setPos({ x: d.start.x + p.x - d.from.x, y: d.start.y + p.y - d.from.y }); }}
                onPointerUp={() => (drag.current = null)} />
            )}
          </div>

          {placing ? (
            <>
              <label className="field"><span>Turn · {angle}°</span>
                <input type="range" min={-180} max={180} step={1} value={angle} onChange={(e) => setAngle(Number(e.target.value))} />
              </label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="btn" onClick={() => setFlip(!flip)}>Mirror (other ear / hand)</button>
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
