import Link from "next/link";
import { describeDesign, type Design } from "@/lib/design";
import type { ChatMessage } from "@/lib/chat";
import { plainReply } from "@/lib/chat";
import { formatMoney, versionName, type PriceVersion } from "@/lib/studio/pricing";
import { eventText, type DashEvent } from "@/lib/studio/dashboard";

export type LinkPieceView = {
  designId: string; name: string; base: Design; version: Design; changes: string[]; chat: ChatMessage[];
  /** the priced version the client's piece matches (null: none), and whether this piece has prices at all */
  priced?: PriceVersion | null; hasPrices?: boolean;
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");

/**
 * One client link as the jeweller sees it: each piece with what the client changed, the workshop sheet for it, and
 * their whole conversation with the design assistant; then everything they did, in order. Shared by the studio and the demo.
 */
export default function LinkDetailView({ clientName, status, allowed, backHref, controls, pricing, pieces, events, specHref }: {
  clientName: string; status: string; allowed: string; backHref: string; controls?: React.ReactNode; pricing?: React.ReactNode;
  pieces: LinkPieceView[]; events: DashEvent[];
  /** the workshop sheet for a piece, as designed or as the client has it */
  specHref: (designId: string, clients: boolean) => string;
}) {
  const nameOf = (id: string | null) => (id ? pieces.find((p) => p.designId === id)?.name ?? "a piece" : null);
  return (
    <main className="page">
      <div style={{ display: "grid", gap: 6 }}>
        <Link href={backHref} className="small muted">← Studio</Link>
        <h1 style={{ fontSize: 36 }}>{clientName}</h1>
        <span className="small muted">{status}</span>
        <span className="small muted">They can change: {allowed}</span>
      </div>
      {controls}
      {pricing}

      {pieces.map((p) => (
        <section key={p.designId} className="card" style={{ padding: 16, gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22 }}>{p.name}</h2>
            <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Link className="btn" href={specHref(p.designId, false)}>Workshop sheet (as designed)</Link>
              {p.changes.length > 0 && <Link className="btn primary" href={specHref(p.designId, true)}>Workshop sheet ({clientName}&apos;s version)</Link>}
            </span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{describeDesign(p.version)}</p>
          {p.changes.length ? <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{p.changes.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="small muted" style={{ margin: 0 }}>No changes: as you designed it.</p>}
          {p.priced ? (
            <p className="small" style={{ margin: 0 }}>{clientName} sees your price: <strong>{formatMoney(p.priced.inr, "INR")}</strong> ({versionName(p.base, p.priced)})</p>
          ) : p.hasPrices ? (
            <p className="small muted" style={{ margin: 0 }}>Their version isn&apos;t one you priced, so they see &ldquo;price on request&rdquo;.</p>
          ) : null}
          {p.chat.length > 0 && (
            <details open>
              <summary className="small">What {clientName} asked the design assistant ({p.chat.filter((m) => m.role === "user").length} {p.chat.filter((m) => m.role === "user").length === 1 ? "question" : "questions"})</summary>
              <div className="chat" style={{ marginTop: 8 }}>
                {p.chat.map((m, i) => (
                  <div key={i} style={{ display: "grid", gap: 6 }}>
                    <div className={`msg ${m.role}`}>{m.role === "assistant" ? plainReply(m.content) : m.content}</div>
                    {m.proposals?.map((s, j) => (
                      <div key={j} className="small muted" style={{ paddingLeft: 12 }}>
                        Suggested: {s.title} · {s.state === "applied" ? "they tried it" : s.state === "dismissed" ? "not for them" : "no answer"}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          )}
        </section>
      ))}

      <section style={{ display: "grid", gap: 8 }}>
        <h3>Timeline</h3>
        {!events.length ? <p className="small muted">Nothing yet.</p> : (
          <ul className="feed">{events.map((e) => <li key={e.id}><span className="small muted">{when(e.at)}</span> {clientName} {eventText(e, nameOf(e.design_id))}</li>)}</ul>
        )}
      </section>
    </main>
  );
}

export { when as linkWhen };
