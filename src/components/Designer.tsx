"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveDesign, setThumbnail } from "@/app/actions";
import { applyPatch, describeDesign, type Design, type DesignPatch } from "@/lib/design";
import { createClient } from "@/lib/supabase/client";
import type { RingCanvasHandle, View } from "./RingCanvas";
import DesignControls from "./DesignControls";
import DesignChat from "./DesignChat";
import StoneUploader from "./StoneUploader";

const RingCanvas = dynamic(() => import("./RingCanvas"), { ssr: false, loading: () => <div className="muted" style={{ padding: 24 }}>Loading 3D…</div> });

type Tab = "design" | "stone" | "chat";
type Props = { initial: Design; id: string | null; userId: string | null };

export default function Designer({ initial, id: initialId, userId }: Props) {
  const router = useRouter();
  const canvas = useRef<RingCanvasHandle>(null);
  const [design, setDesign] = useState(initial);
  const [id, setId] = useState(initialId);
  const [tab, setTab] = useState<Tab>("design");
  const [view, setView] = useState<View>("hero");
  const [spin, setSpin] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const change = (patch: DesignPatch) => { setDesign((d) => applyPatch(d, patch)); setDirty(true); };

  async function save(): Promise<string | null> {
    if (!userId) { router.push(`/login?next=${encodeURIComponent(id ? `/design/${id}` : "/design")}`); return null; }
    setStatus("Saving…");
    const r = await saveDesign(id, design);
    if (r.error || !r.id) { setStatus(r.error ?? "Save failed."); return null; }
    const newId = r.id;
    setDirty(false);
    if (!id) { setId(newId); window.history.replaceState(null, "", `/design/${newId}`); }
    // thumbnail for the gallery and share previews
    const blob = await canvas.current?.snapshot();
    if (blob) {
      const path = `${userId}/${newId}.jpg`;
      const { error } = await createClient().storage.from("thumbnails").upload(path, blob, { contentType: "image/jpeg", upsert: true });
      if (!error) await setThumbnail(newId, path);
    }
    setStatus("Saved");
    setTimeout(() => setStatus(null), 2000);
    return newId;
  }

  async function share() {
    const current = !id || dirty ? await save() : id;
    if (!current) return;
    const link = `${window.location.origin}/d/${current}`;
    try { await navigator.clipboard.writeText(link); setStatus("Share link copied"); }
    catch { setStatus(link); }
  }

  return (
    <div className="designer">
      <div className="stage">
        <RingCanvas ref={canvas} design={design} view={view} autoRotate={spin} />
        <div className="stage-ui">
          <p className="summary">{describeDesign(design)}</p>
          <div className="chips" role="group" aria-label="View">
            {(["hero", "top", "profile"] as View[]).map((v) => (
              <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{v === "hero" ? "¾" : v}</button>
            ))}
            <button type="button" className="chip" aria-pressed={spin} onClick={() => setSpin(!spin)}>Spin</button>
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
          {tab === "design" && <DesignControls design={design} onChange={change} />}
          {tab === "stone" && <StoneUploader userId={userId} onApply={(stone) => { change({ center: stone }); setTab("design"); }} />}
          {tab === "chat" && <DesignChat userId={userId} design={design} onApply={change} />}
        </div>
        <div className="panel-foot">
          <button className="btn primary" type="button" onClick={save}>{id ? "Save" : "Save ring"}</button>
          <button className="btn" type="button" onClick={share}>Copy share link</button>
          {status && <span className="small muted" role="status">{status}</span>}
        </div>
      </aside>
    </div>
  );
}
