import StudioDashboard from "@/components/studio/StudioDashboard";
import { BRAND } from "@/lib/brand";
import { studioSummary, type DashEvent } from "@/lib/studio/dashboard";
import { requireStudioAdmin } from "@/lib/studio/guard";
import { allDesigns, allLinks, listAccounts, recentEvents } from "@/lib/studio/server";

export const dynamic = "force-dynamic";
export const metadata = { title: `Studio · ${BRAND.name}`, robots: { index: false } };

/** The studio's overview, for its master accounts only. */
export default async function StudioPage() {
  await requireStudioAdmin();
  const [links, events, designs, accounts] = await Promise.all([allLinks(), recentEvents(500), allDesigns(), listAccounts()]);
  const names = Object.fromEntries(designs.map((d) => [d.id, d.name]));
  const counts = new Map<string, number>();
  designs.forEach((d) => counts.set(d.owner, (counts.get(d.owner) ?? 0) + 1));
  return (
    <main className="page">
      <h1 style={{ fontSize: 40 }}>Studio</h1>
      <StudioDashboard
        summary={studioSummary(links, events as DashEvent[], names)}
        accounts={accounts.map((a) => ({ ...a, designs: counts.get(a.id) ?? 0 }))}
        linkHref={(id) => `/studio/links/${id}`} accountHref={(id) => `/studio/accounts/${id}`} newLinkHref="/studio/send" />
    </main>
  );
}
