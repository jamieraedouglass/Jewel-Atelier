"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveDesign, setPublic, setThumbnail } from "@/app/actions";
import { applyPatch, describeDesign, type Design, type DesignPatch } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import { VIEW_LABEL, type Pick, type RingCanvasHandle, type View } from "./RingCanvas";
import QuickEdit from "./QuickEdit";
import DesignControls from "./DesignControls";
import DesignChat from "./DesignChat";
import StoneUploader from "./StoneUploader";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false, loading: () => <div className="muted" style={{ padding: 24 }}>Loading 3D…</div> });

type Tab = "design" | "stone" | "chat";
type Props = { initial: Design; id: string | null; userId: string | null; isPublic?: boolean };

const fileName = (d: Design) => `${d.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "design"}.png`;

export default function Designer({ initial, id: initialId, userId, isPublic: initialPublic = false }: Props) {
  const router = useRouter();
  const canvas = useRef<RingCanvasHandle | null>(null);
  const [design, setDesign] = useState(initial);
  const [id, setId] = useState(initialId);
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [tab, setTab] = useState<Tab>("design");
  const [view, setView] = useState<View>("hero");
  const [spin, setSpin] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pick, setPick] = useState<Pick | null>(null);
  const stageEl = useRef<HTMLDivElement>(null);
  const spinRef = useRef(spin);
  spinRef.current = spin;

  /** a click on the paused piece: open the quick editor there, kept inside the view */
  function onPick(p: Pick) {
    if (spinRef.current) return; // clicks edit only while the piece is paused
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

  const change = (patch: DesignPatch) => { setDesign((d) => applyPatch(d, patch)); setDirty(true); };
  const replace = (d: Design) => { setDesign(d); setDirty(true); };
  const flash = (msg: string) => { setStatus(msg); setTimeout(() => setStatus((s) => (s === msg ? null : s)), 2500); };

  async function save(): Promise<string | null> {
    if (!userId) { router.push(`/login?next=${encodeURIComponent(id ? `/design/${id}` : "/design")}`); return null; }
    setStatus("Saving…");
    const r = await saveDesign(id, design);
    if (r.error || !r.id) { setStatus(r.error ?? "Save failed."); return null; }
    const newId = r.id;
    setDirty(false);
    // thumbnail for the gallery; a failure here never loses the saved design
    try {
      const blob = await canvas.current?.snapshot();
      if (blob) {
        const path = `${userId}/${newId}.jpg`;
        const { error } = await createClient().storage.from("thumbnails").upload(path, blob, { contentType: "image/jpeg", upsert: true });
        if (!error) await setThumbnail(newId, path);
      }
    } catch { /* keep going */ }
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
        <RingCanvas handle={canvas} design={design} view={view} autoRotate={spin} onPick={onPick} onMiss={() => setPick(null)} />
        <p className="stage-hint">{spin ? "Pause the spin to click a part and edit it" : "Click any part of the piece to edit it"}</p>
        {pick && !spin && <QuickEdit pick={pick} design={design} onChange={change} onMore={showSection} onClose={() => setPick(null)} />}
        <div className="stage-ui">
          <p className="summary">{describeDesign(design)}</p>
          <div className="chips" role="group" aria-label="View">
            {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>
            ))}
            <button type="button" className="chip" aria-pressed={spin} onClick={() => { setSpin(!spin); setPick(null); }}>{spin ? "Pause" : "Spin"}</button>
          </div>
        </div>
      </div>

      <aside className="panel">
        <div className="tabs" role="tablist">
          {(["design", "stone", "chat"] as Tab[]).map((t) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === "design" ? "Design" : t === "stone" ? "Upload stone" : "Ask the designer"}
            </button>
          ))}
        </div>
        <div className="panel-body">
          {tab === "design" && <DesignControls design={design} userId={userId} onChange={change} onReplace={replace} />}
          {tab === "stone" && <StoneUploader userId={userId} onApply={(stone) => { change({ center: stone }); setTab("design"); }} />}
          {tab === "chat" && <DesignChat userId={userId} design={design} onApply={change} />}
        </div>
        <div className="panel-foot">
          <button className="btn primary" type="button" onClick={save}>{dirty || !id ? "Save" : "Saved"}</button>
          <button className="btn" type="button" onClick={downloadImage}>Download image</button>
          <button className="btn" type="button" onClick={whatsapp}>WhatsApp</button>
          <button className="btn" type="button" onClick={copyLink}>Copy link</button>
          {isPublic && <button className="btn" type="button" onClick={makePrivate} title="Stop anyone else opening this design">Turn off link</button>}
          {status && <span className="small muted" role="status">{status}</span>}
        </div>
      </aside>
    </div>
  );
}
