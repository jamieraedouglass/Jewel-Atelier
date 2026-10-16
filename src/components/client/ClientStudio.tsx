"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { describeDesign, type Design } from "@/lib/design";
import { describeChanges, type Allow } from "@/lib/studio/links";
import type { ChatMessage } from "@/lib/chat";
import { VIEW_LABEL, type Cutout, type RingCanvasHandle, type View } from "../canvas/types";
import TryOn, { type TryOnExtra } from "../TryOn";
import AdjustPanel from "./AdjustPanel";
import ClientChat from "./ClientChat";
import AskJeweller from "./AskJeweller";
import { demoBackend, linkBackend, type ClientPieceData } from "./backend";

const RingCanvas = dynamic(() => import("../RingCanvas"), { ssr: false, loading: () => <div className="muted" style={{ padding: 24 }}>Loading 3D…</div> });

type Props = {
  studioName: string; clientName: string; note: string; allow: Allow; pieces: ClientPieceData[];
  /** a real link (by its token), or the demo, which runs entirely in the browser */
  mode: { kind: "link"; token: string } | { kind: "demo" };
  /** demo only: show what the jeweller would see */
  onDemoEvent?: (line: string) => void;
};
type Panel = "adjust" | "chat" | "jeweller";
const LOOPS = new Set(["necklace", "bracelet", "anklet"]);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * What a client sees on a link from the jeweller: the pieces as tabs, each in 3D, adjustable only as the jeweller
 * allowed, with side-by-side comparing, trying the whole set on, the designer chat, and a line to the jeweller.
 */
export default function ClientStudio({ studioName, clientName, note, allow, pieces, mode, onDemoEvent }: Props) {
  const backend = useMemo(() => (mode.kind === "link" ? linkBackend(mode.token) : demoBackend(pieces, allow, onDemoEvent)), [mode, pieces, allow, onDemoEvent]);
  const [active, setActive] = useState(0);
  const [versions, setVersions] = useState<Record<string, Design>>(() => Object.fromEntries(pieces.map((p) => [p.designId, p.version])));
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => Object.fromEntries(pieces.map((p) => [p.designId, p.chat])));
  const [compare, setCompare] = useState<number | null>(null);
  const [panel, setPanel] = useState<Panel>("adjust");
  const [view, setView] = useState<View>("hero");
  const [spin, setSpin] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [tryOn, setTryOn] = useState<{ main: Cutout; title: string; front: Cutout | null; extras: TryOnExtra[] } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const canvas = useRef<RingCanvasHandle | null>(null);
  const piece = pieces[active];
  const design = versions[piece.designId];

  // adjustments save on their own, a moment after the last change
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);
  function change(d: Design) {
    const id = piece.designId;
    setVersions((cur) => ({ ...cur, [id]: d }));
    clearTimeout(timers.current[id]);
    timers.current[id] = setTimeout(async () => {
      try {
        const kept = await backend.save(id, d);
        if (kept) setVersions((cur) => (JSON.stringify(cur[id]) === JSON.stringify(d) ? { ...cur, [id]: kept } : cur));
        setStatus("Saved for the jeweller");
      } catch (e) { setStatus(e instanceof Error ? e.message : "Couldn't save just now."); }
    }, 700);
  }

  /** a true-size picture of each piece, taken one after another in the same 3D view, for trying the set on */
  async function captureSet(all: boolean) {
    const handle = () => canvas.current;
    const shot = (d: Design) => (LOOPS.has(d.type) ? handle()?.cutout?.("front", "left", 0.45) : handle()?.cutout?.("whole")) ?? null;
    if (!all || pieces.length < 2) {
      const main = handle()?.cutout?.("whole");
      if (!main) { setStatus("Give the 3D view a moment to load, then try again."); return; }
      setTryOn({ main, title: piece.name, front: LOOPS.has(design.type) ? handle()?.cutout?.("front", "left", 0.45) ?? null : null, extras: [] });
      void backend.event(piece.designId, "tried-on").catch(() => {});
      return;
    }
    setCapturing(true); setCompare(null); setSpin(false);
    const start = active, shots: { title: string; cutout: Cutout | null }[] = [];
    for (let i = 0; i < pieces.length; i++) {
      setActive(i);
      await wait(1600);
      shots.push({ title: pieces[i].name, cutout: shot(versions[pieces[i].designId]) });
    }
    setActive(start);
    setCapturing(false);
    const [main, ...rest] = [shots[start], ...shots.filter((_, i) => i !== start)];
    if (!main?.cutout) { setStatus("Couldn't capture the pieces. Try again in a moment."); return; }
    setTryOn({ main: main.cutout, title: main.title, front: null, extras: rest.filter((x): x is TryOnExtra => !!x.cutout) });
    void backend.event(null, "tried-on").catch(() => {});
  }

  const other = compare !== null ? pieces[compare] : null;
  return (
    <div style={{ display: "grid" }}>
      <div className="client-head">
        <div>
          <span className="small muted">{studioName} · for {clientName}</span>
          {note && <p style={{ margin: "4px 0 0" }}>{note}</p>}
        </div>
        {pieces.length > 1 && (
          <div className="chips" role="tablist" aria-label="Pieces">
            {pieces.map((p, i) => (
              <button key={p.designId} type="button" role="tab" className="chip" style={{ textTransform: "none" }} aria-selected={i === active}
                onClick={() => { setActive(i); if (compare === i) setCompare(null); }}>
                {p.name}{describeChanges(p.base, versions[p.designId]).length ? " ·" : ""}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="designer">
        <div className="stage" style={other ? { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", overflow: "hidden" } : undefined}>
          <div style={{ position: "relative", minHeight: 0, minWidth: 0, height: "100%" }}>
            <RingCanvas handle={canvas} design={design} view={view} autoRotate={spin} quality="high" />
            {other && <span className="compare-label">{piece.name}</span>}
          </div>
          {other && (
            <div style={{ position: "relative", minHeight: 0, minWidth: 0, height: "100%", borderLeft: "1px solid var(--line)" }}>
              <RingCanvas design={versions[other.designId]} view={view} autoRotate={spin} quality="standard" />
              <span className="compare-label">{other.name}</span>
            </div>
          )}
          {capturing && <div className="blank-stage" style={{ background: "rgba(0,0,0,0.55)" }}><p>Getting each piece ready to try on…</p></div>}
          {tryOn && <TryOn cutout={tryOn.main} front={tryOn.front} title={tryOn.title} extras={tryOn.extras} onClose={() => setTryOn(null)} />}
          <div className="stage-ui">
            <p className="summary">{describeDesign(design)}</p>
            <div className="chips" role="group" aria-label="Look">
              {(Object.keys(VIEW_LABEL) as View[]).map((v) => <button key={v} type="button" className="chip" aria-pressed={view === v} onClick={() => setView(v)}>{VIEW_LABEL[v]}</button>)}
              <button type="button" className="chip" aria-pressed={spin} onClick={() => setSpin(!spin)}>{spin ? "Pause" : "Spin"}</button>
              {pieces.length > 1 && (
                <button type="button" className="chip" aria-pressed={compare !== null}
                  onClick={() => { const next = compare === null ? (active + 1) % pieces.length : null; setCompare(next); if (next !== null) void backend.event(null, "compared").catch(() => {}); }}>
                  {compare === null ? "Compare" : "One at a time"}
                </button>
              )}
              {other && pieces.length > 2 && (
                <select aria-label="Compare with" value={compare ?? ""} onChange={(e) => setCompare(Number(e.target.value))} style={{ width: "auto", padding: "4px 8px" }}>
                  {pieces.map((p, i) => (i === active ? null : <option key={p.designId} value={i}>{p.name}</option>))}
                </select>
              )}
              <button type="button" className="chip" onClick={() => captureSet(false)}>Try it on</button>
              {pieces.length > 1 && <button type="button" className="chip" disabled={capturing} onClick={() => captureSet(true)}>Try on together</button>}
            </div>
          </div>
        </div>
        <aside className="panel">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={panel === "adjust"} onClick={() => setPanel("adjust")}>Adjust</button>
            {allow.chat && <button role="tab" aria-selected={panel === "chat"} onClick={() => setPanel("chat")}>Ask the designer</button>}
            <button role="tab" aria-selected={panel === "jeweller"} onClick={() => setPanel("jeweller")}>Ask the jeweller</button>
          </div>
          <div className="panel-body">
            <h2 style={{ fontSize: 24 }}>{piece.name}</h2>
            {panel === "adjust" && <AdjustPanel base={piece.base} design={design} allow={allow} onChange={change} />}
            {panel === "chat" && allow.chat && (
              <ClientChat designId={piece.designId} base={piece.base} design={design} history={chats[piece.designId] ?? []} backend={backend}
                onApply={change} onHistory={(h) => setChats((cur) => ({ ...cur, [piece.designId]: h }))} />
            )}
            {panel === "jeweller" && <AskJeweller backend={backend} designId={piece.designId} studioName={studioName} />}
          </div>
          {status && <div className="panel-foot"><span className="small muted" role="status">{status}</span></div>}
        </aside>
      </div>
    </div>
  );
}
