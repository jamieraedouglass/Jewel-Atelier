"use client";

import { Fragment } from "react";
import { TYPE_LABEL, gemLabel } from "@/lib/design";
import type { Taste } from "@/lib/style/profile";

const line = (pairs: [string, number][]) => pairs.map(([k, n]) => `${k} (${n})`).join(", ");

export default function TasteCard({ taste, onAdopt }: { taste: Taste | null; onAdopt: () => void }) {
  if (!taste || taste.designs < 2) {
    return <p className="small muted" style={{ margin: 0 }}>Save a few designs and the designer will also learn from what you make.</p>;
  }
  const rows: [string, string][] = [
    ["Pieces", line(taste.types.map(([t, n]) => [TYPE_LABEL[t], n]))],
    ["Styles", line(taste.styles)],
    ["Metals", line(taste.metals)],
    ["Stones", line(taste.gems.map(([g, n]) => [gemLabel(g), n]))],
    ["Colour grades", line(taste.grades)],
    ["Shapes", line(taste.shapes)],
  ];
  return (
    <section style={{ display: "grid", gap: 10, border: "1px solid var(--line)", borderRadius: 12, padding: 14 }}>
      <h3 style={{ margin: 0 }}>What your {taste.designs} saved designs say</h3>
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", margin: 0 }} className="small">
        {rows.filter(([, v]) => v).map(([k, v]) => (<Fragment key={k}><dt className="muted">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></Fragment>))}
      </dl>
      <p className="small muted" style={{ margin: 0 }}>The designer reads this too, so suggestions follow what you actually make.</p>
      <div><button type="button" className="btn" onClick={onAdopt}>Fill empty preferences from these</button></div>
    </section>
  );
}
