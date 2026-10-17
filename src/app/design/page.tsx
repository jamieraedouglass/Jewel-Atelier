import Designer from "@/components/Designer";
import { TYPES, applyPatch, chooseStyle, defaultDesign, type PieceType } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";
import { loadStyleProfile } from "@/lib/style/load";
import { designDefaultsFrom } from "@/lib/style/profile";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `New design · ${BRAND.name}` };

export default async function NewDesignPage({ searchParams }: { searchParams: { type?: string; style?: string } }) {
  const { supabase, user } = await requireUser();
  const type = (TYPES as readonly string[]).includes(searchParams.type ?? "") ? (searchParams.type as PieceType) : null;
  const profile = user ? await loadStyleProfile(supabase, user.id) : null;
  const base = profile ? applyPatch(defaultDesign(), designDefaultsFrom(profile.prefs)) : defaultDesign();
  const initial = type ? chooseStyle(base, type, searchParams.style) : base;
  return <Designer initial={initial} id={null} userId={user?.id ?? null} blank={!type} />;
}
