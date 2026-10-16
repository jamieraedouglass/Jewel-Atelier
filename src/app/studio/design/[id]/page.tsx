import Link from "next/link";
import { notFound } from "next/navigation";
import RingViewer from "@/components/RingViewer";
import { BRAND } from "@/lib/brand";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { STATUS_LABEL, normalizeStatus } from "@/lib/inventory";
import { requireStudioAdmin } from "@/lib/studio/guard";
import { designById, listAccounts } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const metadata = { title: `Design · ${BRAND.name}`, robots: { index: false } };

/** any account's design, read-only, for the studio's master accounts */
export default async function StudioDesignPage({ params }: { params: { id: string } }) {
  await requireStudioAdmin();
  const row = await designById(params.id);
  if (!row) notFound();
  const design = normalizeDesign(row.data);
  const owner = (await listAccounts()).find((a) => a.id === row.owner);
  return (
    <main className="page">
      <div style={{ display: "grid", gap: 6 }}>
        <Link href={owner ? `/studio/accounts/${owner.id}` : "/studio"} className="small muted">← {owner?.name ?? "Studio"}</Link>
        <h1 style={{ fontSize: 34 }}>{row.name}</h1>
        <span className="small muted">{describeDesign(design)} · {STATUS_LABEL[normalizeStatus(row.status)]}</span>
      </div>
      <RingViewer design={design} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Link className="btn primary" href={`/studio/send?designs=${row.id}`}>Send to a client</Link>
        <Link className="btn" href={`/studio/spec/${row.id}`}>Spec sheet</Link>
      </div>
    </main>
  );
}
