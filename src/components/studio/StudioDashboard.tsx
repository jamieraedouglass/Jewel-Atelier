import Link from "next/link";
import type { StudioSummary } from "@/lib/studio/dashboard";
import { when as whenOr } from "@/lib/format";

const when = (iso: string | null) => whenOr(iso, "not yet");

const STATE_LABEL = { active: "Active", expired: "Expired", revoked: "Turned off" } as const;

type AccountRow = { id: string; name: string; designs: number; lastSignIn: string | null };

export default function StudioDashboard({ summary: s, accounts, linkHref, accountHref, newLinkHref }: {
  summary: StudioSummary; accounts: AccountRow[]; linkHref: (id: string) => string; accountHref?: (id: string) => string; newLinkHref?: string;
}) {
  const tiles: [string, number][] = [["Active links", s.tiles.activeLinks], ["Opened this week", s.tiles.openedThisWeek], ["Messages to you", s.tiles.messages], ["Questions to the designer", s.tiles.designerQuestions]];
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <div className="tiles">
        {tiles.map(([k, v]) => <div key={k} className="tile"><b>{v}</b><span className="small muted">{k}</span></div>)}
      </div>

      {s.needsYou.length > 0 && (
        <section style={{ display: "grid", gap: 10 }}>
          <h3>Needs you</h3>
          {s.needsYou.map((f) => (
            <Link key={f.id} href={linkHref(f.linkId)} className="card" style={{ padding: 12, borderColor: "var(--accent-2, var(--accent))" }}>
              <span>{f.text}</span><span className="small muted">{when(f.at)}</span>
            </Link>
          ))}
        </section>
      )}

      <section style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <h3>Client links</h3>
          {newLinkHref && <Link href={newLinkHref} className="btn primary">Send designs to a client</Link>}
        </div>
        {!s.links.length ? <p className="muted small">No links yet. Open a design and choose Send to client.</p> : (
          <table className="inv-table">
            <thead><tr><th>Client</th><th>Pieces</th><th>Status</th><th>Last opened</th><th>Opens</th><th>Changes</th><th>Questions</th></tr></thead>
            <tbody>
              {s.links.map((l) => (
                <tr key={l.id}>
                  <td><Link href={linkHref(l.id)}><strong>{l.clientName}</strong></Link>{l.waiting && <span className="badge made" style={{ marginLeft: 8 }}>Message</span>}</td>
                  <td className="small">{l.pieces.join(", ")}</td>
                  <td><span className={`badge ${l.state === "active" ? "made" : ""}`}>{STATE_LABEL[l.state]}</span></td>
                  <td className="small">{when(l.lastOpenedAt)}</td>
                  <td>{l.opens}</td><td>{l.changes}</td><td>{l.questions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="row2" style={{ alignItems: "start", gap: 28 }}>
        <section style={{ display: "grid", gap: 8 }}>
          <h3>Activity</h3>
          {!s.feed.length ? <p className="muted small">Nothing yet.</p> : (
            <ul className="feed">{s.feed.map((f) => <li key={f.id}><span className="small muted">{when(f.at)}</span> {f.text}</li>)}</ul>
          )}
        </section>
        <section style={{ display: "grid", gap: 18 }}>
          {s.mostViewed.length > 0 && (
            <div style={{ display: "grid", gap: 8 }}>
              <h3>Most looked-at pieces</h3>
              <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>{s.mostViewed.map((p) => <li key={p.name}>{p.name} · {p.interactions} interactions</li>)}</ol>
            </div>
          )}
          <div style={{ display: "grid", gap: 8 }}>
            <h3>Accounts</h3>
            <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
              {accounts.map((a) => (
                <li key={a.id}>{accountHref ? <Link href={accountHref(a.id)}>{a.name}</Link> : a.name} · {a.designs} design{a.designs === 1 ? "" : "s"} · last in {when(a.lastSignIn)}</li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
