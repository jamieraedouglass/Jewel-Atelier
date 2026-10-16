import { redirect } from "next/navigation";
import StyleProfileEditor from "@/components/StyleProfileEditor";
import { requireUser } from "@/lib/supabase/server";
import { loadStyleProfile, loadTaste } from "@/lib/style/load";
import { normalizePrefs } from "@/lib/style/profile";
import { freshRead } from "@/lib/style/context";

export const metadata = { title: "Style profile · Atelier" };

export default async function StylePage() {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login?next=/style");
  const [profile, taste] = await Promise.all([loadStyleProfile(supabase, user.id), loadTaste(supabase, user.id)]);
  const paths = profile?.image_paths ?? [];
  const signed = paths.length ? (await supabase.storage.from("inspiration").createSignedUrls(paths, 3600)).data ?? [] : [];
  const images = paths.map((p) => ({ path: p, url: signed.find((s) => s.path === p)?.signedUrl ?? "" }));
  return (
    <main className="page" style={{ maxWidth: 820 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 40 }}>Style profile</h1>
        <p className="muted" style={{ margin: 0 }}>
          The design consultant reads this before every suggestion: your preferences, your inspiration, and what your own designs show.
          New designs also start in your metal and sizes.
        </p>
      </div>
      <StyleProfileEditor userId={user.id} taste={taste}
        initial={{
          icons: profile?.icons ?? [], notes: profile?.notes ?? "", images, prefs: profile?.prefs ?? normalizePrefs({}),
          applied: profile?.applied ?? [], dismissed: profile?.dismissed ?? [], photoRead: profile && freshRead(profile) ? profile.photoRead : "",
        }} />
    </main>
  );
}
