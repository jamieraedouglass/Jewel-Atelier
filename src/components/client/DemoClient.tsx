"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { DEMO_ALLOW, DEMO_CLIENT, DEMO_PIECES } from "@/lib/studio/demo";
import ClientStudio from "./ClientStudio";

/** the client demo, with a panel showing what the jeweller sees as the client works (live) */
export default function DemoClient({ studioName }: { studioName: string }) {
  const [log, setLog] = useState<string[]>([`${DEMO_CLIENT.name} opened the link`]);
  const [open, setOpen] = useState(true);
  const onDemoEvent = useCallback((line: string) => setLog((cur) => [`${DEMO_CLIENT.name}: ${line}`, ...cur].slice(0, 12)), []);
  return (
    <>
      <ClientStudio studioName={studioName} clientName={DEMO_CLIENT.name} note={DEMO_CLIENT.note} allow={DEMO_ALLOW} pieces={DEMO_PIECES} mode={{ kind: "demo" }} onDemoEvent={onDemoEvent} />
      <aside className="demo-log" aria-label="What the jeweller sees">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <strong className="small">Demo · what the jeweller sees</strong>
          <button type="button" className="chip" onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
        </div>
        {open && (
          <>
            <ul className="small" style={{ margin: 0, paddingLeft: 16 }}>{log.map((l, i) => <li key={i}>{l}</li>)}</ul>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="chip" href="/demo/studio">The studio dashboard</Link>
              <Link className="chip" href="/demo/spec">Workshop sheet</Link>
              <Link className="chip" href="/demo">Back to the demo</Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
