import DemoClient from "@/components/client/DemoClient";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `For Meher · ${BRAND.name}` };

export default function DemoClientPage() {
  return <DemoClient studioName={BRAND.studioName} />;
}
