"use client";

import { useMemo, useState } from "react";
import { createClientLink } from "@/app/studio/actions";
import { BEAD_GEMS, GEMS, GEM_LOOK, KARATS, METALS, SHAPES, label, varietiesOf } from "@/lib/design";
import { AllowSchema, type Allow, type StoneOption, optionLook, optionName } from "@/lib/studio/links";
import { Chips, Range, Toggle } from "../controls/fields";
import MultiChips from "../style/MultiChips";

type DesignRow = { id: string; name: string; summary: string; owner: string };

/** every stone a client could be offered: each gem, and each of its colour grades */
const STONE_OPTIONS: StoneOption[] = GEMS.filter((g) => !BEAD_GEMS.has(g) && g !== "other").flatMap((gem) => [{ gem }, ...varietiesOf(gem).map((v) => ({ gem, grade: v.id }))]);
const keyOf = (o: StoneOption) => `${o.gem}:${o.grade ?? ""}`;

/** Carl picks the pieces, what the client may change, and how long the link lasts; the result is a private link. */
export default function SendForm({ designs, initial }: { designs: DesignRow[]; initial: string[] }) {
  const [clientName, setClientName] = useState("");
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>(initial.filter((id) => designs.some((d) => d.id === id)));
  const [query, setQuery] = useState("");
  const [allow, setAllow] = useState<Allow>(AllowSchema.parse({}));
  const [expires, setExpires] = useState(30);
  const [aiLimit, setAiLimit] = useState(20);
  const [result, setResult] = useState<{ url?: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => designs.filter((d) => !query.trim() || `${d.name} ${d.summary}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 60), [designs, query]);
  const set = (p: Partial<Allow>) => setAllow((a) => ({ ...a, ...p }));
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length < 8 ? [...cur, id] : cur));

  async function create() {
    setBusy(true); setResult(null);
    const r = await createClientLink({ clientName, note, designIds: picked, allow, expiresInDays: expires, aiDailyLimit: allow.chat ? aiLimit : 0 }).catch(() => ({ error: "Couldn't create the link just now." }));
    setResult(r); setBusy(false);
  }

  if (result?.url) {
    const wa = `https://wa.me/?text=${encodeURIComponent(`${clientName}, here are the pieces we discussed: ${result.url}`)}`;
    return (
      <section className="card" style={{ padding: 18, gap: 12 }}>
        <h2 style={{ fontSize: 24 }}>Ready for {clientName}</h2>
        <code style={{ wordBreak: "break-all" }}>{result.url}</code>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn primary" onClick={() => navigator.clipboard.writeText(result.url!)}>Copy link</button>
          <a className="btn" href={wa} target="_blank" rel="noopener">Send on WhatsApp</a>
          <a className="btn" href={result.url} target="_blank" rel="noopener">Open as the client</a>
          <a className="btn" href="/studio">Back to the studio</a>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Anyone with this link can open it, so send it only to {clientName}. You can turn it off any time from the studio.</p>
      </section>
    );
  }

  return (
    <div style={{ display: "grid", gap: 24 }}>
      <section style={{ display: "grid", gap: 10 }}>
        <h3>For</h3>
        <div className="row2">
          <label className="field"><span>Client&apos;s name</span><input type="text" value={clientName} maxLength={80} onChange={(e) => setClientName(e.target.value)} placeholder="Meher" /></label>
          <label className="field"><span>Link open for</span>
            <select value={expires} onChange={(e) => setExpires(Number(e.target.value))}>
              {[[7, "A week"], [30, "A month"], [90, "Three months"], [0, "No end date"]].map(([d, t]) => <option key={d} value={d}>{t}</option>)}
            </select>
          </label>
        </div>
        <label className="field"><span>A note for them (optional)</span><textarea value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} placeholder="As we discussed: the two rings to choose between, and earrings to go with them." /></label>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h3>Pieces ({picked.length} of up to 8, in this order)</h3>
        {picked.length > 0 && <div className="chips">{picked.map((id, i) => <button key={id} type="button" className="chip" aria-pressed="true" style={{ textTransform: "none" }} onClick={() => toggle(id)}>{i + 1}. {designs.find((d) => d.id === id)?.name} ×</button>)}</div>}
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search designs" aria-label="Search designs" />
        <div style={{ display: "grid", gap: 6, maxHeight: 260, overflowY: "auto" }}>
          {shown.map((d) => (
            <label key={d.id} style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <input type="checkbox" checked={picked.includes(d.id)} onChange={() => toggle(d.id)} />
              <span><strong>{d.name}</strong> <span className="small muted">{d.summary} · {d.owner}</span></span>
            </label>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 10 }}>
        <h3>What they can change</h3>
        <Toggle id="a-sizes" checked={allow.sizes} onChange={(sizes) => set({ sizes })}>Sizes (ring size, wrist, length)</Toggle>
        <span className="small muted">Centre stones they can choose (their piece&apos;s own stone is always an option)</span>
        <MultiChips name="Stone options" options={STONE_OPTIONS.map(keyOf)} value={allow.stones.map(keyOf)} max={12}
          fmt={(k) => optionName(STONE_OPTIONS.find((o) => keyOf(o) === k)!)} swatch={(k) => { const o = STONE_OPTIONS.find((x) => keyOf(x) === k)!; return o.grade ? optionLook(o).color : GEM_LOOK[o.gem].color; }}
          onChange={(keys) => set({ stones: keys.map((k) => STONE_OPTIONS.find((o) => keyOf(o) === k)!) })} />
        <span className="small muted">Shapes they can choose</span>
        <MultiChips name="Shape options" options={SHAPES} value={allow.shapes} max={12} fmt={label} onChange={(shapes) => set({ shapes })} />
        <Range id="a-scale" label="Stone size" value={Math.round(allow.stoneScale * 100)} min={0} max={50} step={5} format={(n) => (n ? `up to ${n}% bigger or smaller` : "fixed")} onChange={(n) => set({ stoneScale: n / 100 })} />
        <span className="small muted">Metals they can choose</span>
        <MultiChips name="Metal options" options={METALS} value={allow.metals} fmt={label} onChange={(metals) => set({ metals })} />
        <span className="small muted">Karats they can choose</span>
        <MultiChips name="Karat options" options={KARATS.map(String)} value={allow.karats.map(String)} fmt={(k) => `${k}k`} onChange={(ks) => set({ karats: ks.map(Number) })} />
        <Toggle id="a-chat" checked={allow.chat} onChange={(chat) => set({ chat })}>Let them ask the AI designer</Toggle>
        {allow.chat && <Chips name="Designer questions a day" options={[10, 20, 40] as const} value={aiLimit as 10 | 20 | 40} fmt={(n) => `${n} questions a day`} onPick={setAiLimit} />}
        <p className="small muted" style={{ margin: 0 }}>Whatever they change is saved as their own copy; your designs never change. Prices are never shown: they&apos;ll ask you.</p>
      </section>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <button type="button" className="btn primary" disabled={busy || !clientName.trim() || !picked.length} onClick={create}>{busy ? "Creating…" : "Create the link"}</button>
        {result?.error && <span className="error">{result.error}</span>}
      </div>
    </div>
  );
}
