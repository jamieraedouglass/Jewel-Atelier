import type { Design } from "@/lib/design";
import { buildSpec } from "@/lib/studio/spec";

// The fact sheet under a shared design: every stone (how many, what size, how many carats), the metal and its weight
// from the 3D model, and the piece's details. Estimates throughout, labelled as such.
export default function FactSheet({ design }: { design: Design }) {
  let spec: ReturnType<typeof buildSpec>;
  try { spec = buildSpec(design); } catch { return null; }
  const stones = spec.stones;
  const count = stones.reduce((a, s) => a + s.count, 0);
  const carats = Math.round(stones.reduce((a, s) => a + (s.totalCt ?? 0), 0) * 100) / 100;
  // With a coloured stone in the piece, the count is of all its stones, and the diamonds' weight is given on its own too.
  const diamonds = stones.filter((s) => s.what.includes("Diamond"));
  const allDiamonds = diamonds.length === stones.length;
  const diamondCt = Math.round(diamonds.reduce((a, s) => a + (s.totalCt ?? 0), 0) * 100) / 100;
  const cell = { padding: "8px 10px", borderBottom: "1px solid var(--line)", textAlign: "left" as const, verticalAlign: "top" as const };
  const head = { ...cell, fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "var(--muted)", fontWeight: 500 };
  return (
    <section style={{ display: "grid", gap: 16 }} aria-label="Fact sheet">
      <div style={{ display: "grid", gap: 4 }}>
        <h2 style={{ margin: 0 }}>Fact sheet</h2>
        <p className="muted small" style={{ margin: 0 }}>Sizes, carats and metal weight are estimated from the 3D model. Confirm against the real stones and casting.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        {[
          [allDiamonds ? "Diamonds" : "Stones", `${count.toLocaleString()} stones`],
          ["Total weight", `≈ ${carats} ct`],
          ...(allDiamonds || !diamonds.length ? [] : [["Diamond weight", `≈ ${diamondCt} ct`]]),
          ["Metal", spec.metal.name],
          ["Metal weight", `≈ ${spec.metal.weightG} g`],
        ].map(([k, v]) => (
          <div key={k} style={{ border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: "12px 14px", display: "grid", gap: 2 }}>
            <span className="small muted">{k}</span>
            <strong style={{ fontSize: 20, fontVariantNumeric: "tabular-nums" }}>{v}</strong>
          </div>
        ))}
      </div>
      {stones.length > 0 && (
        <div style={{ overflowX: "auto", border: "1px solid var(--line)", borderRadius: "var(--radius)" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 560, fontVariantNumeric: "tabular-nums" }}>
            <thead><tr><th style={head}>Stone</th><th style={head}>How many</th><th style={head}>Size</th><th style={head}>Each</th><th style={head}>Total</th></tr></thead>
            <tbody>
              {stones.map((s) => (
                <tr key={`${s.what}|${s.size}`}>
                  <td style={cell}>{s.what}</td>
                  <td style={cell}>{s.count}</td>
                  <td style={cell}>{s.size}</td>
                  <td style={cell}>{s.eachCt != null ? `≈ ${s.eachCt} ct` : "graduated"}</td>
                  <td style={cell}>{s.totalCt != null ? `≈ ${s.totalCt} ct` : "–"}</td>
                </tr>
              ))}
              <tr><td style={{ ...cell, fontWeight: 600 }}>All stones</td><td style={{ ...cell, fontWeight: 600 }}>{count}</td><td style={cell} /><td style={cell} /><td style={{ ...cell, fontWeight: 600 }}>≈ {carats} ct</td></tr>
            </tbody>
          </table>
        </div>
      )}
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "6px 16px", margin: 0 }}>
        {spec.facts.map(([k, v]) => (
          <div key={k} style={{ display: "contents" }}><dt className="muted">{k}</dt><dd style={{ margin: 0 }}>{v}</dd></div>
        ))}
      </dl>
      {spec.notes.filter((n) => !n.startsWith("Stone weights marked")).map((n) => <p key={n} className="small" style={{ margin: 0, maxWidth: "70ch" }}>{n}</p>)}
    </section>
  );
}
