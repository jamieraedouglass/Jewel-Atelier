import Link from "next/link";
import { redirect } from "next/navigation";
import { copyDesign, deleteDesign } from "@/app/actions";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import HoverSpin from "@/components/HoverSpin";

export const metadata = { title: "My designs · Atelier" };

export default async function MyRings() {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login?next=/rings");
  const { data: rows } = await supabase.from("designs").select("id, name, data, thumbnail_path, updated_at").eq("owner", user.id).order("updated_at", { ascending: false });
  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 40 }}>My designs</h1>
        <Link href="/design" className="btn primary">New design</Link>
      </div>
      {!rows?.length ? (
        <p className="muted">Nothing saved yet. Start a design, upload a stone, and press Save.</p>
      ) : (
        <div className="grid">
          {rows.map((r) => {
            const thumb = r.thumbnail_path ? supabase.storage.from("thumbnails").getPublicUrl(r.thumbnail_path).data.publicUrl : null;
            return (
              <div key={r.id} className="card">
                <Link href={`/design/${r.id}`} style={{ textDecoration: "none" }}>
                  <HoverSpin design={normalizeDesign(r.data)} id={r.id} userId={user.id} thumb={thumb ? `${thumb}?v=${new Date(r.updated_at).getTime()}` : null} />
                  <div className="meta">
                    <strong>{r.name}</strong>
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
    </main>
  );
}
