import Link from "next/link";
import { notFound } from "next/navigation";
import PrintButton from "@/components/studio/PrintButton";
import SpecSheet from "@/components/studio/SpecSheet";
import { BRAND } from "@/lib/brand";
import { normalizeDesign } from "@/lib/design";
import { requireStudioAdmin } from "@/lib/studio/guard";
import { buildSpec } from "@/lib/studio/spec";
import { clientVersion, designById } from "@/lib/studio/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: `Spec sheet · ${BRAND.name}`, robots: { index: false } };

/** the workshop sheet for a design as made, or (with ?link=) as a client adjusted it; master accounts only */
export default async function SpecPage({ params, searchParams }: { params: { designId: string }; searchParams: { link?: string } }) {
  await requireStudioAdmin();
  const row = await designById(params.designId);
  if (!row) notFound();
  const v = searchParams.link ? await clientVersion(searchParams.link, params.designId) : null;
  const design = v ? v.version : normalizeDesign(row.data);
  const spec = buildSpec({ ...design, name: v ? `${row.name} · for ${v.clientName}` : row.name });
  return (
    <main className="page">
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
        <Link href={searchParams.link ? `/studio/links/${searchParams.link}` : `/studio/design/${params.designId}`} className="small muted">← Back</Link>
        <PrintButton />
      </div>
      <SpecSheet spec={spec} extra={v && v.changes.length ? [{ label: "Changed by the client", lines: v.changes }] : undefined} />
    </main>
  );
}
