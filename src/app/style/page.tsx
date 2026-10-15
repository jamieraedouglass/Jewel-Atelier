import { redirect } from "next/navigation";
import StyleProfileEditor from "@/components/StyleProfileEditor";
import { requireUser } from "@/lib/supabase/server";

export const metadata = { title: "Style profile · Ring Atelier" };

export default async function StylePage() {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login?next=/style");
  const { data } = await supabase.from("style_profiles").select("icons, notes, image_paths").eq("user_id", user.id).maybeSingle();
  const paths: string[] = data?.image_paths ?? [];
  const signed = paths.length ? (await supabase.storage.from("inspiration").createSignedUrls(paths, 3600)).data ?? [] : [];
  const images = paths.map((p) => ({ path: p, url: signed.find((s) => s.path === p)?.signedUrl ?? "" }));
  return (
    <main className="page" style={{ maxWidth: 820 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 40 }}>Style profile</h1>
        <p className="muted" style={{ margin: 0 }}>
          The design consultant reads this before every suggestion. Add jewellery you love, outfits, interiors, anything that
          captures your taste, plus people whose style you admire.
        </p>
      </div>
      <StyleProfileEditor userId={user.id} initial={{ icons: data?.icons ?? [], notes: data?.notes ?? "", images }} />
    </main>
  );
}
