import Designer from "@/components/Designer";
import { defaultDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "New ring · Ring Atelier" };

export default async function NewDesignPage() {
  const { user } = await requireUser();
  return <Designer initial={defaultDesign()} id={null} userId={user?.id ?? null} />;
}
