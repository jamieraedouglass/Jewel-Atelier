import { notFound } from "next/navigation";
import LinkDetailView, { linkWhen as when } from "@/components/studio/LinkDetailView";
import { BRAND } from "@/lib/brand";
import { DEMO_ALLOW, DEMO_PRICING, demoLinkDetail } from "@/lib/studio/demo";
import { formatMoney, versionName } from "@/lib/studio/pricing";
import { allowedText } from "@/lib/studio/links";

export const metadata = { title: `Client link demo · ${BRAND.name}` };
export const dynamic = "force-dynamic"; // sample activity is dated relative to now

/** a sample client's link, as the jeweller sees it: their changes, what they asked, the workshop sheets */
export default function DemoLinkPage({ params }: { params: { id: string } }) {
  const detail = demoLinkDetail(params.id);
  if (!detail) notFound();
  const { link, pieces, events } = detail;
  return (
    <>
      <p className="page small muted" style={{ paddingBottom: 0 }}>Demo · a sample client&apos;s link as you&apos;d see it</p>
      <LinkDetailView clientName={link.client_name} backHref="/demo/studio" pieces={pieces} events={events}
        pricing={link.id === "demo-meher" ? (
          <details className="card" style={{ padding: 16, gap: 10 }}>
            <summary><strong>Prices</strong> <span className="small muted">(you can change these any time; the client sees them in the currency you pick)</span></summary>
            <ul className="small" style={{ margin: "10px 0 0", paddingLeft: 18 }}>
              {pieces.flatMap((p) => (DEMO_PRICING.pieces[p.designId] ?? []).map((v, i) => <li key={`${p.designId}-${i}`}>{p.name}, {versionName(p.base, v)}: {formatMoney(v.inr, "INR")}</li>))}
            </ul>
          </details>
        ) : undefined}
        status={`Active · sent ${when(link.created_at)} · last opened ${when(link.last_opened_at)}`}
        allowed={allowedText(DEMO_ALLOW, 20)}
        specHref={(id, clients) => `/demo/spec?piece=${id}${clients ? `&client=${link.id}` : ""}`} />
    </>
  );
}
