import type { Spec } from "@/lib/studio/spec";

export default function SpecSheet({ spec, extra }: { spec: Spec; extra?: { label: string; lines: string[] }[] }) {
  const total = spec.stones.reduce((n, s) => n + (s.totalCt ?? 0), 0);
  return (
    <article className="spec">
      <header style={{ display: "grid", gap: 4 }}>
        <span className="small muted">Spec sheet · for the workshop · {new Date().toLocaleDateString("en-IN")}</span>
        <h1 style={{ fontSize: 32 }}>{spec.title}</h1>
        <p className="muted" style={{ margin: 0 }}>{spec.summary}</p>
      </header>
      <dl className="spec-facts">
        {spec.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        <div><dt>Metal weight</dt><dd>≈ {spec.metal.weightG} g {spec.metal.name.toLowerCase()} <span className="small muted">({spec.metal.density} g/cm³)</span></dd></div>
      </dl>
      <section>
        <h3>Stones</h3>
        {!spec.stones.length ? <p className="small muted">No stones.</p> : (
          <table className="inv-table">
            <thead><tr><th>Stone</th><th>Count</th><th>Size</th><th>Each</th><th>Total</th></tr></thead>
            <tbody>
              {spec.stones.map((s, i) => (
                <tr key={i}><td>{s.what}</td><td>{s.count}</td><td>{s.size}</td><td>{s.eachCt != null ? `≈ ${s.eachCt} ct` : ""}</td><td>{s.totalCt != null ? `≈ ${s.totalCt} ct` : ""}</td></tr>
              ))}
              <tr><td colSpan={4}><b>All stones</b></td><td><b>≈ {Math.round(total * 100) / 100} ct</b></td></tr>
            </tbody>
          </table>
        )}
      </section>
      {extra?.map((x) => (
        <section key={x.label}>
          <h3>{x.label}</h3>
          <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{x.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </section>
      ))}
      <section>
        <h3>Notes</h3>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{spec.notes.map((n) => <li key={n}>{n}</li>)}</ul>
      </section>
    </article>
  );
}
