import { notFound, redirect } from "next/navigation";
import Designer from "@/components/Designer";
import { normalizeDesign } from "@/lib/design";
import { requireUser } from "@/lib/supabase/server";

export default async function EditDesignPage({ params }: { params: { id: string } }) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from("designs").select("id, owner, data").eq("id", params.id).maybeSingle();
  if (!data) notFound();
  if (!user || data.owner !== user.id) redirect(`/d/${params.id}`); // other people's rings open read-only
  return <Designer initial={normalizeDesign(data.data)} id={data.id} userId={user.id} />;
}
