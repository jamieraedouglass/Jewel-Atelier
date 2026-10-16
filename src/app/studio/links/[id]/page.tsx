import { notFound } from "next/navigation";
import { headers } from "next/headers";
import LinkControls from "@/components/studio/LinkControls";
import LinkDetailView, { linkWhen as when } from "@/components/studio/LinkDetailView";
import { BRAND } from "@/lib/brand";
import { requireStudioAdmin } from "@/lib/studio/guard";
import { allowedText } from "@/lib/studio/links";
import { linkDetail } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const metadata = { title: `Client link · ${BRAND.name}`, robots: { index: false } };

/** one client link: what they changed on each piece, what they asked, and the link's controls */
export default async function LinkPage({ params }: { params: { id: string } }) {
  await requireStudioAdmin();
  const detail = await linkDetail(params.id);
  if (!detail) notFound();
  const { link, allow, state, pieces, events } = detail;
  const host = headers().get("host") ?? "";
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || `https://${host}`;
  const status = `${state === "active" ? "Active" : state === "expired" ? "Expired" : "Turned off"} · sent ${when(link.created_at)} · last opened ${when(link.last_opened_at)}`
    + (link.expires_at ? ` · ${state === "expired" ? "ended" : "open until"} ${when(link.expires_at)}` : " · no end date");
  return (
    <LinkDetailView clientName={link.client_name} status={status} allowed={allowedText(allow, link.ai_daily_limit)} backHref="/studio"
      controls={<LinkControls id={link.id} url={`${site}/c/${link.token}`} revoked={link.revoked} clientName={link.client_name} />}
      pieces={pieces} events={events}
      specHref={(id, clients) => (clients ? `/studio/spec/${id}?link=${link.id}` : `/studio/spec/${id}`)} />
  );
}
