"use client";

import { useState } from "react";

const ICON_IDEAS = ["Grace Kelly", "Jackie Kennedy", "Carolyn Bessette-Kennedy", "Sofia Richie Grainge", "Kelly Rutherford", "Princess Diana", "Audrey Hepburn", "Zendaya", "Gayatri Devi", "Rekha"];

export default function StyleIcons({ icons, onChange }: { icons: string[]; onChange: (icons: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = (name: string) => {
    const n = name.trim();
    if (n && !icons.includes(n) && icons.length < 12) onChange([...icons, n]);
    setDraft("");
  };
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <h3>Style icons <span className="muted small">(optional)</span></h3>
      <div className="chips">
        {icons.map((n) => (
          <button key={n} type="button" className="chip" aria-pressed="true" style={{ textTransform: "none" }} onClick={() => onChange(icons.filter((x) => x !== n))}>{n} ×</button>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); add(draft); }} style={{ display: "flex", gap: 8 }}>
        <input id="icon-input" type="text" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a name" />
        <button className="btn" type="submit">Add</button>
      </form>
      <div className="chips">
        {ICON_IDEAS.filter((n) => !icons.includes(n)).map((n) => (
          <button key={n} type="button" className="chip" style={{ textTransform: "none" }} onClick={() => add(n)}>+ {n}</button>
        ))}
      </div>
    </section>
  );
}
