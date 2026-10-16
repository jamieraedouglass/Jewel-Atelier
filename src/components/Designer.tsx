"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { duplicateDesign, listVersions, saveDesign, setPublic, setThumbnail } from "@/app/actions";
import { TYPES, TYPE_LABEL, applyPatch, asRightEar, chooseStyle, describeDesign, normalizeDesign, rightEarDesign, type Design, type DesignPatch } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import { VIEW_LABEL, type Cutout, type Measure, type Pick, type RingCanvasHandle, type View } from "./RingCanvas";
import TryOn from "./TryOn";
import QuickEdit from "./QuickEdit";
import DesignControls from "./DesignControls";
import DesignChat from "./DesignChat";
import StoneUploader from "./StoneUploader";
import PhotoToDesign from "./PhotoToDesign";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false, loading: () => <div className="muted" style={{ padding: 24 }}>Loading 3D…</div> });

type Tab = "design" | "photo" | "stone" | "chat";
type Props = { initial: Design; id: string | null; userId: string | null; isPublic?: boolean; hasThumbnail?: boolean; blank?: boolean };

const fileName = (d: Design) => `${d.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "design"}.png`;

export default function Designer({ initial, id: initialId, userId, isPublic: initialPublic = false, hasThumbnail = true, blank = false }: Props) {
  const router = useRouter();
  const canvas = useRef<RingCanvasHandle | null>(null);
  const [design, setDesign] = useState(initial);
  const [id, setId] = useState(initialId);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [tab, setTab] = useState<Tab>("design");
  const [view, setView] = useState<View>("hero");
  const [spin, setSpin] = useState(true);
  // a new design starts on an empty stage until a piece is chosen (or anything is changed)
  const [started, setStarted] = useState(!blank);
  // render quality is a per-viewer choice, remembered on this device
  const [quality, setQualityState] = useState<"high" | "standard">("high");
  useEffect(() => { try { const q = localStorage.getItem("render-quality"); if (q === "standard" || q === "high") setQualityState(q); } catch { /* private mode */ } }, []);
  const setQuality = (q: "high" | "standard") => { setQualityState(q); try { localStorage.setItem("render-quality", q); } catch { /* ignore */ } };
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const spinRef = useRef(spin);
  spinRef.current = spin;

  /** a click on the paused piece: open the quick editor there, kept inside the view */
  function onPick(p: Pick) {
    if (spinRef.current) return; // clicks edit only while the piece is paused
    if (p.ear && designRef.current.rightEar) setEar(p.ear);
    const w = stageEl.current?.clientWidth ?? 800, h = stageEl.current?.clientHeight ?? 600;
    setPick({ ...p, x: Math.max(8, Math.min(p.x + 12, w - 296)), y: Math.max(8, Math.min(p.y - 20, h - 340)) });
  }
  /** jump to a part's full settings in the side panel */
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

  /* ---- undo / redo: quick runs of changes (dragging a slider) count as one step ---- */
  const designRef = useRef(design);
  designRef.current = design;
  const hist = useRef<{ past: Design[]; future: Design[]; last: number }>({ past: [], future: [], last: 0 });
  const [, bumpHist] = useState(0);
  function record(next: Design, group: boolean) {
    const h = hist.current, now = Date.now();
    if (next === designRef.current) return;
    if (!group || now - h.last > 800) { h.past.push(designRef.current); if (h.past.length > 150) h.past.shift(); }
    h.last = group ? now : 0;
    h.future = [];
    designRef.current = next;
    setDesign(next); setDirty(true); bumpHist((n) => n + 1); setStarted(true);
  }
  function undo() {
    const h = hist.current, prev = h.past.pop();
    if (!prev) return;
    h.future.push(designRef.current); h.last = 0;
    designRef.current = prev; setDesign(prev); setDirty(true); bumpHist((n) => n + 1); setPick(null);
  }
  function redo() {
    const h = hist.current, nxt = h.future.pop();
    if (!nxt) return;
    h.past.push(designRef.current); h.last = 0;
    designRef.current = nxt; setDesign(nxt); setDirty(true); bumpHist((n) => n + 1); setPick(null);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || (t.tagName === "INPUT" && (t as HTMLInputElement).type === "text"))) return; // text boxes keep their own undo
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === "z" && e.shiftKey) || k === "y") { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- earrings: a matching pair, or each earring designed on its own ---- */
  const [ear, setEar] = useState<"left" | "right">("left");
  const earRef = useRef(ear);
  earRef.current = ear;
  const unmatched = design.type === "earrings" && !!design.rightEar;
  const onRight = () => designRef.current.type === "earrings" && !!designRef.current.rightEar && earRef.current === "right";
  // the pair's own settings always apply to both earrings
  const PAIR_KEYS = new Set(["metal", "purity", "name", "rightEar", "mirrorPair"]);
  const change = (patch: DesignPatch) => {
    const cur = designRef.current;
    if (!onRight() || patch.type) return record(applyPatch(cur, patch), true);
    // split the change: pair settings to the pair, the rest to the right earring
    const pairPart: Record<string, unknown> = {}, earPart: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) (PAIR_KEYS.has(k) ? pairPart : earPart)[k] = v;
    const base = Object.keys(pairPart).length ? applyPatch(cur, pairPart as DesignPatch) : cur;
    record({ ...base, rightEar: asRightEar(applyPatch(rightEarDesign(base), earPart as DesignPatch)) }, true);
  };
  const replace = (d: Design) => {
    const cur = designRef.current;
    if (onRight() && d.type === "earrings") return record({ ...cur, rightEar: asRightEar(d) }, false);
    record(d, false);
  };
  function setMatched(matched: boolean) {
    const cur = designRef.current;
    if (matched) { record({ ...cur, rightEar: null }, false); setEar("left"); }
    else record({ ...cur, rightEar: asRightEar(cur) }, false);
  }
  const editing = unmatched && ear === "right" ? rightEarDesign(design) : design;

  /* ---- real size ---- */
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [tryOn, setTryOn] = useState<Cutout | null>(null);
  function openTryOn() {
    const c = canvas.current?.cutout?.();
    if (c) { setSpin(false); setTryOn(c); } else flash("Couldn't capture the piece. Try again in a moment.");
  }

  /* ---- copies and versions ---- */
  const [versions, setVersions] = useState<{ id: string; name: string; created_at: string; data: unknown }[] | null>(null);
  async function makeCopy() {
    if (!userId) { router.push("/login"); return; }
    if (id && dirty) await save();
    setStatus("Making a copy…");
    const r = await duplicateDesign(designRef.current);
    if (r.error || !r.id) { setStatus(r.error ?? "Couldn't copy."); return; }
    flash("Copy made. You're editing the copy now.");
    router.push(`/design/${r.id}`);
  }
  async function showVersions() {
    if (!id) return;
    if (versions) { setVersions(null); return; }
    setVersions(await listVersions(id));
  }
  const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus((s) => (s === msg ? null : s)), 2500); };

  /** a picture of the piece for the gallery; a failure here never loses the saved design */
  async function saveThumbnail(designId: string) {
    if (!userId) return;
    try {
      const blob = await canvas.current?.snapshot();
      if (!blob || blob.size < 2000) return; // nothing drawn yet
      const path = `${userId}/${designId}.jpg`;
      const { error } = await createClient().storage.from("thumbnails").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (error) console.warn("thumbnail upload failed:", error.message);
      else await setThumbnail(designId, path);
    } catch (e) { console.warn("thumbnail failed", e); }
  }

  // designs saved before pictures worked get one the first time they are opened
  useEffect(() => {
    if (!initialId || !userId || hasThumbnail) return;
    const t = setTimeout(() => void saveThumbnail(initialId), 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(): Promise<string | null> {
    if (!userId) { router.push(`/login?next=${encodeURIComponent(id ? `/design/${id}` : "/design")}`); return null; }
    setStatus("Saving…");
    const r = await saveDesign(id, design);
    if (r.error || !r.id) { setStatus(r.error ?? "Save failed."); return null; }
    const newId = r.id;
    setDirty(false);
    await saveThumbnail(newId);
    flash("Saved");
    if (!id) {
      setId(newId);
      // move to the design's own address through the router rather than editing browser history directly
      router.replace(`/design/${newId}`, { scroll: false });
    }
    return newId;
  }

  /** links are private until you share one */
  async function shareLink(): Promise<string | null> {
    const current = !id || dirty ? await save() : id;
    if (!current) return null;
    if (!isPublic) { await setPublic(current, true); setIsPublic(true); }
    return `${window.location.origin}/d/${current}`;
  }

  async function copyLink() {
    const link = await shareLink();
    if (!link) return;
    try { await navigator.clipboard.writeText(link); flash("Link copied. Anyone with it can view."); }
    catch { setStatus(link); }
  }

  async function downloadImage() {
    const blob = await canvas.current?.snapshot("image/png");
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName(design); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** WhatsApp: on phones, share the render itself plus the link; elsewhere open WhatsApp with the link. */
  async function whatsapp() {
    const link = await shareLink();
    if (!link) return;
    const text = `${design.name}: ${describeDesign(design)}\n${link}`;
    const blob = await canvas.current?.snapshot("image/png");
    const file = blob ? new File([blob], fileName(design), { type: "image/png" }) : null;
    if (file && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch { /* cancelled or unsupported: fall through */ }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  }

  async function makePrivate() {
    if (!id) return;
    await setPublic(id, false);
    setIsPublic(false);
    flash("Link turned off");
  }

  return (
    <div className="designer">
      <div className="stage" ref={stageEl}>
        {!started && (
          <div className="blank-stage">
            <h2>What are we making?</h2>
            <p className="muted">Pick a piece to start, choose a showcase design in the panel, or recreate something from a photo.</p>
            <div className="chips" style={{ justifyContent: "center" }}>
              {TYPES.map((t) => <button key={t} type="button" className="btn" onClick={() => replace(chooseStyle(designRef.current, t))}>{TYPE_LABEL[t]}</button>)}
            </div>
            <button type="button" className="btn primary" onClick={() => { setTab("photo"); }}>Start from a photo</button>
          </div>
        )}
        {started && <RingCanvas handle={canvas} design={design} view={view} autoRotate={spin} quality={quality} onPick={onPick} onMiss={() => setPick(null)} onMeasure={setMeasure} />}
        {tryOn && <TryOn cutout={tryOn} title={design.name} onClose={() => setTryOn(null)} />}
        <p className="stage-hint">{spin ? "Pause the spin to click a part and edit it" : "Click any part of the piece to edit it"}</p>
        {pick && !spin && <QuickEdit pick={pick} design={editing} onChange={change} onMore={showSection} onClose={() => setPick(null)} />}
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
            <button type="button" className="chip" disabled={!hist.current.past.length} onClick={undo} title="Undo (Ctrl/⌘ Z)">↶ Undo</button>
            <button type="button" className="chip" disabled={!hist.current.future.length} onClick={redo} title="Redo (Ctrl/⌘ Shift Z)">↷ Redo</button>
            <button type="button" className="chip" onClick={openTryOn} title="See it at true size on a photo of you">Try it on</button>
          </div>
          <div className="chips" role="group" aria-label="View">
            {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
            ))}
            <button type="button" className="chip" aria-pressed={spin} onClick={() => { setSpin(!spin); setPick(null); }}>{spin ? "Pause" : "Spin"}</button>
            <button type="button" className="chip" aria-pressed={quality === "high"} title="Ray-traced diamonds and soft shadows; switch to Standard if stones look wrong or it feels slow"
              onClick={() => setQuality(quality === "high" ? "standard" : "high")}>{quality === "high" ? "Quality: high" : "Quality: standard"}</button>
          </div>
        </div>
      </div>

      <aside className="panel">
        <div className="tabs" role="tablist">
          {(["design", "photo", "stone", "chat"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "design" ? "Design" : t === "photo" ? "From a photo" : t === "stone" ? "Upload stone" : "Ask the designer"}
            </button>
          ))}
        </div>
        <div className="panel-body">
          {versions && (
            <section style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Saved versions</h3>
                <button type="button" className="chip" onClick={() => setVersions(null)} aria-label="Close versions">×</button>
              </div>
              <p className="small muted" style={{ margin: 0 }}>Every save keeps a version (the last 40). Bringing one back puts it on screen; press Save to keep it, or Undo to go back.</p>
              {!versions.length && <p className="small muted">No versions yet. They start with the next save.</p>}
              {versions.map((v, i) => (
                <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, borderTop: "1px solid var(--line)", paddingTop: 8 }}>
                  <span className="small">
                    {new Date(v.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    {i === 0 && <span className="muted"> · latest save</span>}
                    <br /><span className="muted">{describeDesign(normalizeDesign(v.data)).slice(0, 90)}</span>
                  </span>
                  <button type="button" className="btn" onClick={() => { replace(normalizeDesign(v.data)); flash("Version brought back. Save to keep it."); }}>Bring back</button>
                </div>
              ))}
            </section>
          )}
          {design.type === "earrings" && (tab === "design" || tab === "photo" || tab === "stone") && (
            <section className="pairbar" aria-label="The pair">
              <div className="chips" role="group" aria-label="Matching">
                <button type="button" className="chip" aria-pressed={!unmatched} onClick={() => setMatched(true)}>Matching pair</button>
                <button type="button" className="chip" aria-pressed={unmatched} onClick={() => setMatched(false)}>Each earring different</button>
              </div>
              {unmatched ? (
                <>
                  <div className="chips" role="group" aria-label="Which earring you're editing">
                    <span className="small muted" style={{ alignSelf: "center" }}>Editing</span>
                    <button type="button" className="chip" aria-pressed={ear === "left"} onClick={() => setEar("left")}>Left earring</button>
                    <button type="button" className="chip" aria-pressed={ear === "right"} onClick={() => setEar("right")}>Right earring</button>
                  </div>
                  <span className="small muted">Changes go to the {ear} earring only. Metal and karat are shared. Click an earring on the paused piece to switch to it.</span>
                </>
              ) : (
                <>
                  <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <input type="checkbox" checked={design.mirrorPair} onChange={(e) => change({ mirrorPair: e.target.checked })} />
                    Mirror the second earring (angled stones and side parts face the other way)
                  </label>
                  <span className="small muted">Every change applies to both earrings.</span>
                </>
              )}
            </section>
          )}
          {tab === "design" && <DesignControls design={editing} userId={userId} onChange={change} onReplace={replace} />}
          {tab === "photo" && <PhotoToDesign userId={userId} design={editing} onReplace={replace} />}
          {tab === "stone" && <StoneUploader userId={userId} onApply={(stone) => { change({ center: stone }); setTab("design"); }} />}
          {tab === "chat" && <DesignChat userId={userId} design={design} onApply={change} />}
        </div>
        <div className="panel-foot">
          <button className="btn primary" type="button" onClick={save}>{dirty || !id ? "Save" : "Saved"}</button>
          <button className="btn" type="button" onClick={downloadImage}>Download image</button>
          <button className="btn" type="button" onClick={whatsapp}>WhatsApp</button>
          <button className="btn" type="button" onClick={copyLink}>Copy link</button>
          <button className="btn" type="button" onClick={makeCopy} title="Try a variation without changing this one">Make a copy</button>
          {id && <button className="btn" type="button" aria-pressed={!!versions} onClick={showVersions}>Versions</button>}
          {isPublic && <button className="btn" type="button" onClick={makePrivate} title="Stop anyone else opening this design">Turn off link</button>}
          {status && <span className="small muted" role="status">{status}</span>}
        </div>
      </aside>
    </div>
  );
}
