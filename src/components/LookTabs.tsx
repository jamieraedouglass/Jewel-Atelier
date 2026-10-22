"use client";

import { type ReactNode, useState } from "react";

// Tabs for a design's other looks (the original first), each showing its own view and fact sheet.
export default function LookTabs({ tabs }: { tabs: { name: string; body: ReactNode }[] }) {
  const [i, setI] = useState(0);
  if (tabs.length < 2) return <>{tabs[0]?.body}</>;
  return (
    <>
      <div className="chips" role="tablist" aria-label="Looks">
        {tabs.map((t, k) => (
          <button key={t.name} type="button" role="tab" className="chip" aria-selected={k === i} onClick={() => setI(k)}>{t.name}</button>
        ))}
      </div>
      <div role="tabpanel" style={{ display: "grid", gap: 24 }}>{tabs[i].body}</div>
    </>
  );
}
