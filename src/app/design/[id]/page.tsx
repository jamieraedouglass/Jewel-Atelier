import { notFound, redirect } from "next/navigation";
import Designer from "@/components/Designer";
import { normalizeDesign } from "@/lib/design";
import { normalizeStatus } from "@/lib/inventory";
import { requireUser } from "@/lib/supabase/server";
import { isStudioAdmin } from "@/lib/studio/admin";

export default async function EditDesignPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  const pick = (cols: string) => supabase.from("designs").select(cols).eq("id", params.id).maybeSingle();
  let res = await pick("id, owner, data, is_public, thumbnail_path, status");
  if (res.error) res = await pick("id, owner, data, is_public, thumbnail_path");
  const data = res.data as unknown as { id: string; owner: string; data: unknown; is_public: boolean; thumbnail_path: string | null; status?: string } | null;
  if (!data) notFound();
  if (!user || data.owner !== user.id) redirect(`/d/${params.id}`);
  return <Designer initial={normalizeDesign(data.data)} id={data.id} userId={user.id} isPublic={data.is_public} hasThumbnail={!!data.thumbnail_path} status={normalizeStatus(data.status)} isStudioAdmin={isStudioAdmin(user)} />;
}
