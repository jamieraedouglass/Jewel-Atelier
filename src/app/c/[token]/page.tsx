import { notFound } from "next/navigation";
import ClientStudio from "@/components/client/ClientStudio";
import { BRAND } from "@/lib/brand";
import { loadClientBundle, markOpened } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const metadata = { title: BRAND.title, robots: { index: false, follow: false } };

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
  await markOpened(bundle.link);
  return (
    <ClientStudio studioName={BRAND.studioName} clientName={bundle.link.client_name} note={bundle.link.note} allow={bundle.allow}
      pieces={bundle.pieces} mode={{ kind: "link", token: params.token }} />
  );
}
