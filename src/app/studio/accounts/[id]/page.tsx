import Link from "next/link";
import { notFound } from "next/navigation";
import { BRAND } from "@/lib/brand";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { STATUS_LABEL, normalizeStatus } from "@/lib/inventory";
import { requireStudioAdmin } from "@/lib/studio/guard";
import { allDesigns, listAccounts } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const metadata = { title: `Account · ${BRAND.name}`, robots: { index: false } };

/** everything one account has designed, for the studio's master accounts */
export default async function AccountPage({ params }: { params: { id: string } }) {
  await requireStudioAdmin();
  const account = (await listAccounts()).find((a) => a.id === params.id);
  if (!account) notFound();
  const designs = (await allDesigns()).filter((d) => d.owner === params.id);
  return (
    <main className="page">
      <div style={{ display: "grid", gap: 6 }}>
        <Link href="/studio" className="small muted">← Studio</Link>
        <h1 style={{ fontSize: 36 }}>{account.name}</h1>
        <span className="small muted">{designs.length} design{designs.length === 1 ? "" : "s"}</span>
      </div>
      {!designs.length ? <p className="muted">No designs yet.</p> : (
        <div className="grid">
          {designs.map((d) => (
            <Link key={d.id} href={`/studio/design/${d.id}`} className="card" style={{ padding: 14, gap: 6 }}>
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong>{d.name}</strong>
                {normalizeStatus(d.status) !== "idea" && <span className={`badge ${normalizeStatus(d.status)}`}>{STATUS_LABEL[normalizeStatus(d.status)]}</span>}
              </span>
              <span className="small muted">{describeDesign(normalizeDesign(d.data))}</span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
