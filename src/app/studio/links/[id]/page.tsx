import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import LinkControls from "@/components/studio/LinkControls";
import { BRAND } from "@/lib/brand";
import { describeDesign } from "@/lib/design";
import { eventText } from "@/lib/studio/dashboard";
import { requireStudioAdmin } from "@/lib/studio/guard";
import { optionName } from "@/lib/studio/links";
import { linkDetail } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const metadata = { title: `Client link · ${BRAND.name}`, robots: { index: false } };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "never");

/** one client link: what they changed on each piece, what they asked, and the link's controls */
export default async function LinkPage({ params }: { params: { id: string } }) {
  await requireStudioAdmin();
  const detail = await linkDetail(params.id);
  if (!detail) notFound();
  const { link, allow, state, pieces, events } = detail;
  const host = headers().get("host") ?? "";
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `https://${host}`;
  const url = `${site}/c/${link.token}`;
  const nameOf = (id: string | null) => (id ? pieces.find((p) => p.designId === id)?.name ?? "a piece" : null);
  const allowed = [
    allow.sizes && "sizes", allow.stones.length && `stones: ${allow.stones.map(optionName).join(", ")}`, allow.shapes.length && `shapes: ${allow.shapes.join(", ")}`,
    allow.stoneScale && `stone size ±${Math.round(allow.stoneScale * 100)}%`, allow.metals.length && `metals: ${allow.metals.join(", ")}`, allow.karats.length && `karat: ${allow.karats.map((k) => `${k}k`).join(", ")}`,
    allow.chat && `designer chat (${link.ai_daily_limit} a day)`,
  ].filter(Boolean);
  return (
    <main className="page">
      <div style={{ display: "grid", gap: 6 }}>
        <Link href="/studio" className="small muted">← Studio</Link>
        <h1 style={{ fontSize: 36 }}>{link.client_name}</h1>
        <span className="small muted">
          {state === "active" ? "Active" : state === "expired" ? "Expired" : "Turned off"} · sent {when(link.created_at)} · last opened {when(link.last_opened_at)}
          {link.expires_at ? ` · ${state === "expired" ? "ended" : "open until"} ${when(link.expires_at)}` : " · no end date"}
        </span>
        <span className="small muted">They can change: {allowed.join(" · ") || "nothing (view only)"}</span>
      </div>
      <LinkControls id={link.id} url={url} revoked={link.revoked} clientName={link.client_name} />

      {pieces.map((p) => (
        <section key={p.designId} className="card" style={{ padding: 16, gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 22 }}>{p.name}</h2>
            <span style={{ display: "flex", gap: 8 }}>
              <Link className="btn" href={`/studio/spec/${p.designId}`}>Spec sheet (as designed)</Link>
              {p.changes.length > 0 && <Link className="btn primary" href={`/studio/spec/${p.designId}?link=${link.id}`}>Spec sheet (client&apos;s version)</Link>}
            </span>
          </div>
          <p className="small muted" style={{ margin: 0 }}>{describeDesign(p.version)}</p>
          {p.changes.length ? <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>{p.changes.map((c) => <li key={c}>{c}</li>)}</ul> : <p className="small muted" style={{ margin: 0 }}>No changes: as you designed it.</p>}
          {p.chat.length > 0 && (
            <details>
              <summary className="small">Their conversation with the designer ({p.chat.length} messages)</summary>
              <div className="chat" style={{ marginTop: 8 }}>{p.chat.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.content}</div>)}</div>
            </details>
          )}
        </section>
      ))}

      <section style={{ display: "grid", gap: 8 }}>
        <h3>Timeline</h3>
        {!events.length ? <p className="small muted">Nothing yet.</p> : (
          <ul className="feed">{events.map((e) => <li key={e.id}><span className="small muted">{when(e.at)}</span> {link.client_name} {eventText(e, nameOf(e.design_id))}</li>)}</ul>
        )}
      </section>
    </main>
  );
}
