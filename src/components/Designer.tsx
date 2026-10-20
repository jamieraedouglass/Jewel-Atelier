"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { listVersions } from "@/app/actions";
import { TYPES, TYPE_LABEL, chooseStyle, describeDesign, wornCurve, type Design } from "@/lib/design";
import { VIEW_LABEL, type Cutout, type Measure, type Pick, type RingCanvasHandle, type View } from "./canvas/types";
import TryOn from "./TryOn";
import QuickEdit from "./QuickEdit";
import DesignControls from "./DesignControls";
import DesignChat from "./DesignChat";
import StoneUploader from "./StoneUploader";
import PhotoToDesign from "./PhotoToDesign";
import { useHistory } from "./designer/useHistory";
import { useEarPair } from "./designer/useEarPair";
import { useSaving } from "./designer/useSaving";
import VersionsPanel, { type Version } from "./designer/VersionsPanel";
import PairBar from "./designer/PairBar";
import StatusChips from "./designer/StatusChips";
import PhotoStyle from "./designer/PhotoStyle";
import type { Status } from "@/lib/inventory";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false, loading: () => <div className="muted" style={{ padding: 24 }}>Loading 3D…</div> });

type Tab = "design" | "photo" | "stone" | "chat";
const TAB_LABEL: Record<Tab, string> = { design: "Design", photo: "From a photo", stone: "Upload stone", chat: "Ask the designer" };
type Props = { initial: Design; id: string | null; userId: string | null; isPublic?: boolean; hasThumbnail?: boolean; blank?: boolean; status?: Status; isStudioAdmin?: boolean };

export default function Designer({ initial, id: initialId, userId, isPublic: initialPublic = false, hasThumbnail = true, blank = false, status = "idea", isStudioAdmin = false }: Props) {
  const canvas = useRef<RingCanvasHandle | null>(null);
  const [tab, setTab] = useState<Tab>("design");
  const [view, setView] = useState<View>("hero");
  const [spin, setSpin] = useState(true);
  const [started, setStarted] = useState(!blank);
  const [quality, setQualityState] = useState<"high" | "standard">("high");
  useEffect(() => { try { const q = localStorage.getItem("render-quality"); if (q === "standard" || q === "high") setQualityState(q); } catch {} }, []);
  const setQuality = (q: "high" | "standard") => { setQualityState(q); try { localStorage.setItem("render-quality", q); } catch {} };
  const [statusMsg, setStatus] = useState<string | null>(null);
  const [photoStyle, setPhotoStyle] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const spinRef = useRef(spin);
  spinRef.current = spin;
  const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus((s) => (s === msg ? null : s)), 2500); };

  const { design, designRef, record, undo, redo, canUndo, canRedo } = useHistory(initial, () => { setDirty(true); setStarted(true); setPick(null); });
  const pair = useEarPair(designRef, record);
  const saving = useSaving({ initialId, initialPublic, userId, designRef, canvas, dirty, setDirty, flash, setStatus });

  function onPick(p: Pick) {
    if (spinRef.current) return;
    if (p.ear && designRef.current.rightEar) pair.setEar(p.ear);
    const w = stageEl.current?.clientWidth ?? 800, h = stageEl.current?.clientHeight ?? 600;
    setPick({ ...p, x: Math.max(8, Math.min(p.x + 12, w - 296)), y: Math.max(8, Math.min(p.y - 20, h - 340)) });
  }
  function showSection(part: Pick["part"], index?: number) {
    setPick(null);
    setTab("design");
    setTimeout(() => {
      const el = document.getElementById(part === "drop" && index !== undefined ? `drop-part-${index}` : `sec-${part}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      el.classList.remove("flash-section"); void el.offsetWidth; el.classList.add("flash-section");
    }, 60);
  }

  const [measure, setMeasure] = useState<Measure | null>(null);
  const [tryOn, setTryOn] = useState<{ whole: Cutout; front: Cutout | null; right: Cutout | null } | null>(null);
  function openTryOn() {
    const d0 = designRef.current;
    const loop = ["bracelet", "necklace", "anklet"].includes(d0.type);
    const whole = canvas.current?.cutout?.("whole");
    const front = loop ? canvas.current?.cutout?.("front", "left", wornCurve(d0)) ?? null : null;
    const right = d0.type === "earrings" ? canvas.current?.cutout?.("whole", "right") ?? null : null;
    if (whole) { setSpin(false); setTryOn({ whole, front, right }); } else flash("Couldn't capture the piece. Try again in a moment.");
  }

  const [versions, setVersions] = useState<Version[] | null>(null);
  async function showVersions() {
    if (!saving.id) return;
    if (versions) { setVersions(null); return; }
    try { setVersions(await listVersions(saving.id)); } catch { flash("Couldn't load versions."); }
  }

  useEffect(() => {
    if (!initialId || !userId || hasThumbnail) return;
    const t = setTimeout(() => void saving.saveThumbnail(initialId), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="designer">
      <div className="stage" ref={stageEl}>
        {!started && (
          <div className="blank-stage">
            <h2>What are we making?</h2>
            <p className="muted">Pick a piece to start, choose a showcase design in the panel, or recreate something from a photo.</p>
            <div className="chips" style={{ justifyContent: "center" }}>
              {TYPES.map((t) => <button key={t} type="button" className="btn" onClick={() => pair.replace(chooseStyle(designRef.current, t))}>{TYPE_LABEL[t]}</button>)}
            </div>
            <button type="button" className="btn primary" onClick={() => { setTab("photo"); }}>Start from a photo</button>
          </div>
        )}
        {started && <RingCanvas handle={canvas} design={design} view={view} autoRotate={spin} quality={quality} onPick={onPick} onMiss={() => setPick(null)} onMeasure={setMeasure} />}
        {tryOn && <TryOn cutout={tryOn.whole} front={tryOn.front} right={tryOn.right} title={design.name} curve0={wornCurve(design)} onClose={() => setTryOn(null)}
          recut={(flatten) => canvas.current?.cutout?.("front", "left", flatten) ?? null} />}
        <p className="stage-hint">{spin ? "Pause the spin to click a part and edit it" : "Click any part of the piece to edit it"}</p>
        {pick && !spin && <QuickEdit pick={pick} design={pair.editing} onChange={pair.change} onMore={showSection} onClose={() => setPick(null)} />}
        <div className="stage-ui" style={started ? undefined : { display: "none" }}>
          <div>
            <p className="summary">{describeDesign(design)}</p>
            {measure && measure.widthMm > 0 && (
              <p className="small" style={{ margin: "4px 0 0", color: "var(--fg)" }}>
                Real size, {measure.what}: <b>{measure.widthMm} mm</b> across × <b>{measure.lengthMm} mm</b> {design.type === "ring" ? "long" : "top to bottom"}
                {" "}<span className="muted">({(measure.lengthMm / 25.4).toFixed(2)}″)</span>
              </p>
            )}
          </div>
          <div className="chips" role="group" aria-label="Edit history">
            <button type="button" className="chip" disabled={!canUndo} onClick={undo} title="Undo (Ctrl/⌘ Z)">↶ Undo</button>
            <button type="button" className="chip" disabled={!canRedo} onClick={redo} title="Redo (Ctrl/⌘ Shift Z)">↷ Redo</button>
            <button type="button" className="chip" onClick={openTryOn} title="See it at true size on a photo of you">Try it on</button>
          </div>
          <div className="chips" role="group" aria-label="View">
            {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
            ))}
            <button type="button" className="chip" aria-pressed={spin} onClick={() => { setSpin(!spin); setPick(null); }}>{spin ? "Pause" : "Spin"}</button>
            <button type="button" className="chip" title="Lighting: studio light box, daylight from a window, or warm indoor light"
              onClick={() => pair.change({ options: { lighting: ({ studio: "daylight", daylight: "warm", warm: "studio" } as const)[design.options.lighting] } })}>{`Light: ${design.options.lighting}`}</button>
            <button type="button" className="chip" aria-pressed={quality === "high"} title="Ray-traced diamonds and soft shadows; switch to Standard if stones look wrong or it feels slow"
              onClick={() => setQuality(quality === "high" ? "standard" : "high")}>{quality === "high" ? "Quality: high" : "Quality: standard"}</button>
          </div>
        </div>
      </div>

      <aside className="panel">
        <div className="tabs" role="tablist">
          {(Object.keys(TAB_LABEL) as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{TAB_LABEL[t]}</button>
          ))}
        </div>
        <div className="panel-body">
          {versions && (
            <VersionsPanel versions={versions} onClose={() => setVersions(null)}
              onRestore={(d) => { record(d, false); flash("Version brought back. Save to keep it."); }} />
          )}
          {design.type === "earrings" && tab !== "chat" && (
            <PairBar unmatched={pair.unmatched} ear={pair.ear} mirrorPair={design.mirrorPair}
              onMatched={pair.setMatched} onEar={pair.setEar} onMirror={(mirrorPair) => pair.change({ mirrorPair })} />
          )}
          <div className="tab-pane" hidden={tab !== "design"}><DesignControls design={pair.editing} userId={userId} onChange={pair.change} onReplace={pair.replace} /></div>
          <div className="tab-pane" hidden={tab !== "photo"}><PhotoToDesign userId={userId} design={pair.editing} onReplace={pair.replace} capture={async () => (await canvas.current?.hero?.()) ?? (await canvas.current?.snapshot()) ?? null} /></div>
          <div className="tab-pane" hidden={tab !== "stone"}><StoneUploader userId={userId} onApply={(stone) => { pair.change({ center: stone }); setTab("design"); }} /></div>
          <div className="tab-pane" hidden={tab !== "chat"}><DesignChat userId={userId} designId={saving.id} design={design} onApply={pair.change} /></div>
        </div>
        {photoStyle && <PhotoStyle design={design} capture={async () => (await canvas.current?.snapshot("image/png")) ?? null} onClose={() => setPhotoStyle(false)} />}
        <div className="panel-foot">
          <button className="btn primary" type="button" onClick={saving.save}>{dirty || !saving.id ? "Save" : "Saved"}</button>
          <button className="btn" type="button" onClick={saving.downloadImage}>Download image</button>
          <button className="btn" type="button" onClick={() => { setSpin(false); setPhotoStyle(true); }} title="A photo-like picture of this piece, made from the 3D view">Photo-style image</button>
          <button className="btn" type="button" onClick={saving.downloadCad} title="Rhino (.3dm) and STL files at real size in millimetres, plus a link you can send your jeweller">Download for CAD</button>
          <button className="btn" type="button" onClick={saving.whatsapp}>WhatsApp</button>
          <button className="btn" type="button" onClick={saving.copyLink}>Copy link</button>
          <button className="btn" type="button" onClick={saving.makeCopy} title="Try a variation without changing this one">Make a copy</button>
          {saving.id && <button className="btn" type="button" aria-pressed={!!versions} onClick={showVersions}>Versions</button>}
          {saving.isPublic && <button className="btn" type="button" onClick={saving.makePrivate} title="Stop anyone else opening this design">Turn off link</button>}
          {isStudioAdmin && (
            <button className="btn" type="button" title="Send this design to a client as a private link"
              onClick={async () => { const id = saving.id ?? (await saving.save()); if (id) window.location.href = `/studio/send?designs=${id}`; }}>Send to client</button>
          )}
          {userId && <StatusChips id={saving.id} initial={status} onSaveFirst={saving.save} flash={flash} />}
          {statusMsg && <span className="small muted" role="status">{statusMsg}</span>}
        </div>
      </aside>
    </div>
  );
}
