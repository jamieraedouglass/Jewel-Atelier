"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { saveInventory, setDesignStatus } from "@/app/actions";
import { AVAILABILITY, AVAILABILITY_LABEL, inventoryCsv, inventoryTotals, type Inventory, type InventoryRow } from "@/lib/inventory";
import { CURRENCIES } from "@/lib/style/profile";

type Row = InventoryRow & { thumb: string | null };

const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) || Number(v) < 0 ? null : Number(v));
const money = (n: number, c: string) => `${n.toLocaleString("en-IN")} ${c}`;

export default function InventoryTable({ rows: initial }: { rows: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [show, setShow] = useState<"all" | (typeof AVAILABILITY)[number]>("all");
  const [status, setStatus] = useState<string | null>(null);
  const shown = show === "all" ? rows : rows.filter((r) => r.inventory.availability === show);
  const totals = useMemo(() => inventoryTotals(rows), [rows]);

  const edit = (id: string, patch: Partial<Inventory>, madeAt?: string | null) => {
    setRows((cur) => cur.map((r) => (r.id === id ? { ...r, inventory: { ...r.inventory, ...patch }, madeAt: madeAt === undefined ? r.madeAt : madeAt } : r)));
    setDirty((d) => new Set(d).add(id));
  };
  async function save(row: Row) {
    setStatus("Saving…");
    const r = await saveInventory(row.id, row.inventory, row.madeAt).catch(() => ({ error: "Couldn't save. Check your connection." }));
    if (r.error) { setStatus(r.error); return; }
    setDirty((d) => { const n = new Set(d); n.delete(row.id); return n; });
    setStatus(`Saved ${row.name}`);
  }
  async function unmark(row: Row) {
    const r = await setDesignStatus(row.id, "workshop").catch(() => ({ error: "Couldn't change it." }));
    if (r.error) { setStatus(r.error); return; }
    setRows((cur) => cur.filter((x) => x.id !== row.id));
    setStatus(`${row.name} moved back to the workshop`);
  }
  function download() {
    const url = URL.createObjectURL(new Blob([inventoryCsv(rows)], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `inventory-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <section className="card" style={{ padding: 14, display: "flex", gap: 22, flexWrap: "wrap" }} aria-label="Totals">
        <span><b>{totals.pieces}</b> pieces · <b>{totals.inStock}</b> not sold · <b>{totals.sold}</b> sold</span>
        {totals.weightG > 0 && <span><b>{totals.weightG} g</b> metal in hand</span>}
        {totals.stonesCt > 0 && <span><b>{totals.stonesCt} ct</b> stones in hand</span>}
        {totals.value.map(([c, v]) => <span key={c}>Stock <b>{money(v.stock, c)}</b>{v.sold ? <> · sold <b>{money(v.sold, c)}</b></> : null}</span>)}
      </section>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}>
        <div className="chips" role="group" aria-label="Show">
          {(["all", ...AVAILABILITY] as const).map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={show === a} onClick={() => setShow(a)}>{a === "all" ? "All" : AVAILABILITY_LABEL[a]}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {status && <span className="small muted" role="status">{status}</span>}
          <button type="button" className="btn" onClick={download}>Download spreadsheet (CSV)</button>
        </div>
      </div>

      <table className="inv-table">
        <thead>
          <tr><th>Piece</th><th>Reference</th><th>Where it is</th><th>Made</th><th>Metal (g)</th><th>Stones (ct)</th><th>Cost</th><th>Price</th><th>Notes</th><th /></tr>
        </thead>
        <tbody>
          {shown.map((r) => {
            const i = r.inventory, id = (k: string) => `${k}-${r.id}`;
            return (
              <tr key={r.id}>
                <td style={{ minWidth: 180 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    {r.thumb && <img src={r.thumb} alt="" style={{ width: 54, height: 40, objectFit: "cover", borderRadius: 6 }} />}
                    <div style={{ display: "grid", gap: 2 }}>
                      <Link href={`/design/${r.id}`}><strong>{r.name}</strong></Link>
                      <span className="small muted">{r.summary}</span>
                    </div>
                  </div>
                </td>
                <td><input aria-label="Reference" id={id("ref")} value={i.ref} maxLength={40} placeholder="KJ-0142" onChange={(e) => edit(r.id, { ref: e.target.value })} /></td>
                <td>
                  <select aria-label="Where it is" value={i.availability} onChange={(e) => edit(r.id, { availability: e.target.value as Inventory["availability"] })}>
                    {AVAILABILITY.map((a) => <option key={a} value={a}>{AVAILABILITY_LABEL[a]}</option>)}
                  </select>
                  {(i.availability === "with-client" || i.availability === "reserved" || i.availability === "sold") && (
                    <input aria-label="Client" value={i.client} maxLength={80} placeholder="Client" style={{ marginTop: 6 }} onChange={(e) => edit(r.id, { client: e.target.value })} />
                  )}
                </td>
                <td><input aria-label="Made on" type="date" value={r.madeAt?.slice(0, 10) ?? ""} onChange={(e) => edit(r.id, {}, e.target.value || null)} /></td>
                <td><input aria-label="Metal weight in grams" type="number" min={0} step={0.01} value={i.weightG ?? ""} onChange={(e) => edit(r.id, { weightG: num(e.target.value) || null })} /></td>
                <td><input aria-label="Stones in carats" type="number" min={0} step={0.01} value={i.stonesCt ?? ""} onChange={(e) => edit(r.id, { stonesCt: num(e.target.value) || null })} /></td>
                <td><input aria-label="Cost" type="number" min={0} step={100} value={i.cost ?? ""} onChange={(e) => edit(r.id, { cost: num(e.target.value) })} /></td>
                <td>
                  <input aria-label="Price" type="number" min={0} step={100} value={i.price ?? ""} onChange={(e) => edit(r.id, { price: num(e.target.value) })} />
                  <select aria-label="Currency" value={i.currency} style={{ marginTop: 6 }} onChange={(e) => edit(r.id, { currency: e.target.value as Inventory["currency"] })}>
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td><textarea aria-label="Notes" value={i.notes} maxLength={1000} rows={2} style={{ minHeight: 0 }} onChange={(e) => edit(r.id, { notes: e.target.value })} /></td>
                <td style={{ display: "grid", gap: 6 }}>
                  <button type="button" className="btn primary" disabled={!dirty.has(r.id)} onClick={() => save(r)}>{dirty.has(r.id) ? "Save" : "Saved"}</button>
                  <button type="button" className="btn" title="Move it back to In the workshop" onClick={() => unmark(r)}>Not made</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
