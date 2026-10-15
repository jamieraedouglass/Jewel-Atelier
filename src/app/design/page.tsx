import Designer from "@/components/Designer";
import { TYPES, chooseStyle, defaultDesign, type PieceType } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "New design · Atelier" };

export default async function NewDesignPage({ searchParams }: { searchParams: { type?: string; style?: string } }) {
  const { user } = await requireUser();
  const type = (TYPES as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as PieceType) : null;
  const initial = type ? chooseStyle(defaultDesign(), type, searchParams.style) : defaultDesign();
  return <Designer initial={initial} id={null} userId={user?.id ?? null} />;
}
