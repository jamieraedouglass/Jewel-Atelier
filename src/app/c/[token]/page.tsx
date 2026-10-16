import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ClientStudio from "@/components/client/ClientStudio";
import { BRAND } from "@/lib/brand";
import { isPreviewBot, linkPreviewText, thumbnailUrl } from "@/lib/studio/preview";
import { linkPreview, loadClientBundle, markOpened } from "@/lib/studio/server";
import { rupeeRate } from "@/lib/studio/fx";

export const dynamic = "force-dynamic";

/** the preview WhatsApp, iMessage and email show for the link: the piece, who it's for, and its picture */
export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  const base: Metadata = { title: BRAND.title, robots: { index: false, follow: false } };
  const p = await linkPreview(params.token).catch(() => null);
  if (!p) return base;
  const { title, description } = linkPreviewText(BRAND.studioName, p.clientName, p.names);
  const image = thumbnailUrl(process.env.NEXT_PUBLIC_SUPABASE_URL, p.thumbnailPath);
  return {
    ...base, title: `${title} · ${BRAND.name}`, description,
    openGraph: { title, description, siteName: BRAND.name, type: "website", ...(image ? { images: [{ url: image, alt: p.names[0] }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description, ...(image ? { images: [image] } : {}) },
  };
}

/** A client's private link: no sign-in, just the unguessable link the jeweller sent. */
export default async function ClientLinkPage({ params }: { params: { token: string } }) {
  const bundle = await loadClientBundle(params.token);
  if (!bundle) notFound();
  if (bundle.state !== "active" || !bundle.pieces.length) {
    return (
      <main className="page" style={{ maxWidth: 560 }}>
        <h1 style={{ fontSize: 34 }}>This link has {bundle.state === "revoked" ? "been closed" : "expired"}</h1>
        <p className="muted">Ask {BRAND.studioName} for a new one; your earlier changes are kept.</p>
      </main>
    );
  }
  // the robot WhatsApp sends to build a preview isn't the client opening the link
  if (!isPreviewBot(headers().get("user-agent"))) await markOpened(bundle.link);
  const rate = Object.keys(bundle.pricing.pieces).length ? await rupeeRate(bundle.pricing.currency) : null;
  return (
    <ClientStudio studioName={BRAND.studioName} clientName={bundle.link.client_name} note={bundle.link.note} allow={bundle.allow}
      pieces={bundle.pieces} pricing={bundle.pricing} rate={rate} mode={{ kind: "link", token: params.token }} />
  );
}
