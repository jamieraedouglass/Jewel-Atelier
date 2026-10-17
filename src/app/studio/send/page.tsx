import Link from "next/link";
import SendForm from "@/components/studio/SendForm";
import { BRAND } from "@/lib/brand";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { requireStudioAdmin } from "@/lib/studio/guard";
import { allDesigns, designRowsByIds, listAccounts } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const metadata = { title: `Send to a client · ${BRAND.name}`, robots: { index: false } };

export default async function SendPage({ searchParams }: { searchParams: { designs?: string } }) {
  await requireStudioAdmin();
  const wanted = (searchParams.designs ?? "").split(",").filter(Boolean);
  const [recent, accounts] = await Promise.all([allDesigns(), listAccounts()]);
  const missing = wanted.filter((id) => !recent.some((d) => d.id === id));
  const designs = [...(missing.length ? await designRowsByIds(missing) : []), ...recent];
  const owner = (id: string) => accounts.find((a) => a.id === id)?.name ?? "";
  const rows = designs.map((d) => ({ id: d.id, name: d.name, summary: describeDesign(normalizeDesign(d.data)), owner: owner(d.owner) }));
  return (
    <main className="page" style={{ maxWidth: 860 }}>
      <div style={{ display: "grid", gap: 6 }}>
        <Link href="/studio" className="small muted">← Studio</Link>
        <h1 style={{ fontSize: 36 }}>Send designs to a client</h1>
        <p className="muted" style={{ margin: 0 }}>They get a private link: no account needed. They see the pieces in 3D, try them on, and change only what you allow.</p>
      </div>
      <SendForm designs={rows} initial={wanted} />
    </main>
  );
}
