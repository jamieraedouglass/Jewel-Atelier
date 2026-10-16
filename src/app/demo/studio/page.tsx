import Link from "next/link";
import StudioDashboard from "@/components/studio/StudioDashboard";
import { BRAND } from "@/lib/brand";
import { studioSummary } from "@/lib/studio/dashboard";
import { DEMO_NAMES, demoStudio } from "@/lib/studio/demo";

export const metadata = { title: `Studio demo · ${BRAND.name}` };
export const dynamic = "force-dynamic"; // sample activity is dated relative to now

export default function DemoStudioPage() {
  const { links, events, accounts } = demoStudio();
  return (
    <main className="page">
      <div style={{ display: "grid", gap: 6 }}>
        <span className="small muted">Demo · sample clients and activity</span>
        <h1 style={{ fontSize: 40 }}>Studio</h1>
      </div>
      <StudioDashboard summary={studioSummary(links, events, DEMO_NAMES)} accounts={accounts} linkHref={() => "/demo/client"} />
      <p className="small muted no-print"><Link href="/demo">← Back to the demo</Link></p>
    </main>
  );
}
