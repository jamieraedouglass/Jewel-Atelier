import Link from "next/link";
import SpecSheet from "@/components/studio/SpecSheet";
import { BRAND } from "@/lib/brand";
import { applyPatch } from "@/lib/design";
import { describeChanges } from "@/lib/studio/links";
import { buildSpec } from "@/lib/studio/spec";
import { DEMO_PIECES } from "@/lib/studio/demo";

export const metadata = { title: `Workshop sheet demo · ${BRAND.name}` };

/** the sample client's version of the ruby ring, as the workshop would receive it */
export default function DemoSpecPage() {
  const base = DEMO_PIECES[0].base;
  const version = applyPatch(base, { purity: { karat: 22 }, ringSize: 6, center: { lengthMm: base.center.lengthMm * 1.1, widthMm: base.center.widthMm * 1.1, carat: null } });
  return (
    <main className="page">
      <p className="small muted no-print">Demo · Meher&apos;s version of the half-flowered ruby ring · <Link href="/demo">back to the demo</Link> · print this page for the workshop</p>
      <SpecSheet spec={buildSpec({ ...version, name: `${base.name} · for Meher` })} extra={[{ label: "Changed by the client", lines: describeChanges(base, version) }]} />
    </main>
  );
}
