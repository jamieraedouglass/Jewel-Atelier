import Link from "next/link";
import { redirect } from "next/navigation";
import { copyDesign, deleteDesign } from "@/app/actions";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import HoverSpin from "@/components/HoverSpin";
import BackupButtons from "@/components/BackupButtons";
import ThumbStudio from "@/components/gallery/ThumbStudio";
import { STATUSES, STATUS_LABEL, normalizeStatus, type Status } from "@/lib/inventory";
import { BRAND } from "@/lib/brand";
import { isCurrentThumb } from "@/lib/thumbs";

export const metadata = { title: `My designs · ${BRAND.name}` };

export default async function MyRings({ searchParams }: { searchParams: { status?: string } }) {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login?next=/rings");
  const list = (cols: string) => supabase.from("designs").select(cols).eq("owner", user.id).order("updated_at", { ascending: false });
  let res = await list("id, name, data, thumbnail_path, updated_at, status");
  if (res.error) res = await list("id, name, data, thumbnail_path, updated_at"); // before the status column exists
  const all = (res.data ?? []) as unknown as { id: string; name: string; data: unknown; thumbnail_path: string | null; updated_at: string; status?: string }[];
  const filter = (STATUSES as readonly string[]).includes(searchParams.status ?? "") ? (searchParams.status as Status) : null;
  const rows = filter ? all.filter((r) => normalizeStatus(r.status) === filter) : all;
  const counts = Object.fromEntries(STATUSES.map((s) => [s, all.filter((r) => normalizeStatus(r.status) === s).length])) as Record<Status, number>;
  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 40 }}>My designs</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <BackupButtons />
          <Link href="/design" className="btn primary">New design</Link>
        </div>
      </div>
      <div className="chips" role="group" aria-label="Show">
        <Link className="chip" aria-pressed={!filter} href="/rings">All ({all.length})</Link>
        {STATUSES.map((s) => <Link key={s} className="chip" aria-pressed={filter === s} href={`/rings?status=${s}`}>{STATUS_LABEL[s]} ({counts[s]})</Link>)}
      </div>
      {!rows?.length ? (
        <p className="muted">{filter ? `Nothing marked "${STATUS_LABEL[filter].toLowerCase()}" yet.` : "Nothing saved yet. Start a design, upload a stone, and press Save."}</p>
      ) : (
        <div className="grid">
          {rows.map((r) => {
            // an out-of-date picture is redrawn (see thumbs.ts), so every card shows the same lighting and backdrop
            const thumb = isCurrentThumb(r.thumbnail_path) ? supabase.storage.from("thumbnails").getPublicUrl(r.thumbnail_path!).data.publicUrl : null;
            return (
              <div key={r.id} className="card">
                <Link href={`/design/${r.id}`} style={{ textDecoration: "none" }}>
                  <HoverSpin design={normalizeDesign(r.data)} id={r.id} userId={user.id} thumb={thumb ? `${thumb}?v=${new Date(r.updated_at).getTime()}` : null} />
                  <div className="meta">
                    <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                      <strong>{r.name}</strong>
                      {normalizeStatus(r.status) !== "idea" && <span className={`badge ${normalizeStatus(r.status)}`}>{STATUS_LABEL[normalizeStatus(r.status)]}</span>}
                    </span>
                    <span className="small muted">{describeDesign(normalizeDesign(r.data))}</span>
                  </div>
                </Link>
                <div className="meta" style={{ display: "flex", gap: 8, paddingTop: 0 }}>
                  <Link className="btn" href={`/d/${r.id}`}>View</Link>
                  <form action={copyDesign.bind(null, r.id)}><button className="btn">Copy</button></form>
                  <form action={deleteDesign.bind(null, r.id)}><button className="btn">Delete</button></form>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* draws the cards that have no picture yet, one at a time, in a single shared 3D canvas */}
      <ThumbStudio />
    </main>
  );
}
