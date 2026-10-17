"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Design } from "@/lib/design";
import { DEMO_ALLOW, DEMO_CLIENT, DEMO_PIECES, DEMO_PRICING } from "@/lib/studio/demo";
import { clampToAllowed, describeChanges, type Allow } from "@/lib/studio/links";
import { cleanPricing, formatMoney, priceFor, versionName, type Pricing } from "@/lib/studio/pricing";
import { buildSpec } from "@/lib/studio/spec";
import AllowEditor from "../studio/AllowEditor";
import PriceEditor, { filledPricing } from "../studio/PriceEditor";
import ClientStudio from "./ClientStudio";

type Side = "see" | "settings";
/** one object for the whole visit: a new one each render would rebuild the demo's backend and forget what it had logged */
const DEMO_MODE = { kind: "demo" } as const;
const BASES = Object.fromEntries(DEMO_PIECES.map((p) => [p.designId, p.base]));
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The demo to play with: Meher's screen, and beside it the jeweller's side, live. What she changes shows up on his side
 * as it would for real (changes, price, carats, metal weight, activity); what he changes (her options, his prices)
 * shows up on her screen straight away. Nothing is saved.
 */
export default function DemoClient({ studioName }: { studioName: string }) {
  const [allow, setAllow] = useState<Allow>(DEMO_ALLOW);
  const [pricing, setPricing] = useState<Pricing>(DEMO_PRICING);
  const [versions, setVersions] = useState<Record<string, Design>>(() => Object.fromEntries(DEMO_PIECES.map((p) => [p.designId, p.version])));
  const [log, setLog] = useState<string[]>([`${DEMO_CLIENT.name} opened the link`]);
  const [side, setSide] = useState<Side>("see");
  const [open, setOpen] = useState(true);
  // her screen starts again (keeping her changes, within the new rules) when the jeweller changes what she may do
  const [round, setRound] = useState(0);
  // Meher's pieces as they are this moment, including a change not saved yet (her screen restarts from these)
  const latest = useRef(versions);

  const onDemoEvent = useCallback((line: string) => setLog((cur) => [`${DEMO_CLIENT.name}: ${line}`, ...cur].slice(0, 30)), []);
  const onDemoSave = useCallback((id: string, d: Design) => { latest.current = { ...latest.current, [id]: d }; setVersions((cur) => ({ ...cur, [id]: d })); }, []);
  const onDemoChange = useCallback((id: string, d: Design) => { latest.current = { ...latest.current, [id]: d }; }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const pieces = useMemo(() => DEMO_PIECES.map((p) => ({ ...p, version: latest.current[p.designId] })), [round]);
  const shownPricing = useMemo(() => cleanPricing(filledPricing(pricing), BASES, allow), [pricing, allow]);

  function changeAllow(next: Allow) {
    setAllow(next);
    // keep her changes (the latest, even one not saved yet), within what she may now do
    const kept = Object.fromEntries(DEMO_PIECES.map((p) => [p.designId, clampToAllowed(p.base, latest.current[p.designId], next)]));
    latest.current = kept;
    setVersions(kept);
    setRound((n) => n + 1);
  }


  return (
    <div className={`demo-split${open ? "" : " closed"}`}>
      <div style={{ minWidth: 0 }}>
        <ClientStudio key={round} studioName={studioName} clientName={DEMO_CLIENT.name} note={DEMO_CLIENT.note} allow={allow} pieces={pieces} pricing={shownPricing}
          mode={DEMO_MODE} onDemoEvent={onDemoEvent} onDemoSave={onDemoSave} onDemoChange={onDemoChange} />
      </div>
      <aside className="demo-side" aria-label="Your side, live">
        {!open ? (
          <button type="button" className="chip demo-side-open" onClick={() => setOpen(true)} aria-label="Show your side">Your side ›</button>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div>
                <span className="small muted">Demo · nothing is saved</span>
                <h2 style={{ fontSize: 22, margin: 0 }}>Your side, live</h2>
              </div>
              <button type="button" className="chip" onClick={() => setOpen(false)}>Hide</button>
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              On the left is Meher&apos;s screen: play with it as she would. Here is what you see as she does, and the settings you chose when you sent it. Change those and watch her screen follow.
            </p>
            <div className="tabs" role="tablist">
              <button role="tab" aria-selected={side === "see"} onClick={() => setSide("see")}>What you see</button>
              <button role="tab" aria-selected={side === "settings"} onClick={() => setSide("settings")}>Your settings</button>
            </div>

            {side === "see" ? (
              <div style={{ display: "grid", gap: 12 }}>
                {DEMO_PIECES.map((p) => <PieceStatus key={p.designId} name={p.name} base={p.base} version={versions[p.designId]} pricing={shownPricing} id={p.designId} />)}
                <section style={{ display: "grid", gap: 6 }}>
                  <h3>Activity</h3>
                  <ul className="small" style={{ margin: 0, paddingLeft: 16, display: "grid", gap: 4 }}>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
                </section>
                <p className="small muted" style={{ margin: 0 }}>
                  The full pages (with sample clients): <Link href="/demo/studio">dashboard</Link> · <Link href="/demo/link/demo-meher">Meher&apos;s link</Link> · <Link href="/demo/spec">workshop sheet</Link> · <Link href="/demo">back to the demo</Link>
                </p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12 }}>
                <section style={{ display: "grid", gap: 10 }}>
                  <h3>What Meher can change</h3>
                  <AllowEditor allow={allow} onChange={changeAllow} idPrefix="demo" />
                </section>
                <section style={{ display: "grid", gap: 10 }}>
                  <h3>Your prices</h3>
                  <PriceEditor pieces={DEMO_PIECES.map((p) => ({ id: p.designId, name: p.name }))} allow={allow} value={pricing} onChange={setPricing} />
                  <p className="small muted" style={{ margin: 0 }}>In the demo, other currencies show in rupees; on a real link they&apos;re converted at today&apos;s rate.</p>
                </section>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

/** one piece as the jeweller sees it: what she changed, the price she sees, and what it means for the workshop */
function PieceStatus({ id, name, base, version, pricing }: { id: string; name: string; base: Design; version: Design; pricing: Pricing }) {
  const changes = describeChanges(base, version);
  const priced = priceFor(base, version, pricing.pieces[id]);
  const hasPrices = !!pricing.pieces[id]?.length;
  const spec = useMemo(() => buildSpec(version), [version]);
  const carats = r2(spec.stones.reduce((n, s) => n + (s.totalCt ?? 0), 0));
  return (
    <section className="card" style={{ padding: 12, gap: 6 }}>
      <strong className="small">{name}</strong>
      {changes.length
        ? <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>{changes.map((c) => <li key={c}>{c}</li>)}</ul>
        : <span className="small muted">No changes: as you designed it.</span>}
      <span className="small">
        {priced ? <>She sees your price: <strong>{formatMoney(priced.inr, "INR")}</strong> ({versionName(base, priced)})</>
          : hasPrices ? <>She sees <strong>price on request</strong>: her version isn&apos;t one you priced.</>
          : <span className="muted">No price given: she&apos;ll ask you.</span>}
      </span>
      <span className="small muted">For the workshop: stones ≈ {carats} ct · {spec.metal.name} ≈ {spec.metal.weightG} g</span>
    </section>
  );
}
