import Link from "next/link";
import SpecSheet from "@/components/studio/SpecSheet";
import { BRAND } from "@/lib/brand";
import { describeChanges } from "@/lib/studio/links";
import { formatMoney, versionName } from "@/lib/studio/pricing";
import { buildSpec } from "@/lib/studio/spec";
import { DEMO_PIECES, demoLinkDetail } from "@/lib/studio/demo";

export const metadata = { title: `Workshop sheet demo · ${BRAND.name}` };

/** a demo piece's workshop sheet: as designed, or a sample client's version (Meher's ruby ring by default) */
export default function DemoSpecPage({ searchParams }: { searchParams: { piece?: string; client?: string } }) {
  const pieceId = searchParams.piece ?? DEMO_PIECES[0].designId;
  const clientId = searchParams.piece ? searchParams.client : "demo-meher";
  const piece = DEMO_PIECES.find((p) => p.designId === pieceId) ?? DEMO_PIECES[0];
  const detail = clientId ? demoLinkDetail(clientId) : null;
  const theirs = detail?.pieces.find((p) => p.designId === piece.designId);
  const version = theirs?.version ?? piece.base;
  const changes = describeChanges(piece.base, version);
  const who = theirs && changes.length ? detail!.link.client_name : null;
  return (
    <main className="page">
      <p className="small muted no-print">
        Demo · {who ? `${who}'s version of the ${piece.name.toLowerCase()}` : `${piece.name}, as designed`} ·{" "}
        {detail ? <Link href={`/demo/link/${detail.link.id}`}>back to {detail.link.client_name}&apos;s link</Link> : <Link href="/demo">back to the demo</Link>} · print this page for the workshop
      </p>
      <SpecSheet spec={buildSpec({ ...version, name: who ? `${piece.name} · for ${who}` : piece.name })} extra={[
        ...(who ? [{ label: "Changed by the client", lines: changes }] : []),
        ...(theirs?.priced ? [{ label: "Price quoted to the client", lines: [`${formatMoney(theirs.priced.inr, "INR")} (${versionName(piece.base, theirs.priced)})`] }] : []),
      ]} />
    </main>
  );
}
