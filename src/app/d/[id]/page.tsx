import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { copyDesign } from "@/app/actions";
import RingViewer from "@/components/RingViewer";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { createClient } from "@/lib/supabase/server";
import { BRAND } from "@/lib/brand";

async function load(id: string) {
  const supabase = createClient();
  const { data } = await supabase.from("designs").select("id, owner, name, data, thumbnail_path").eq("id", id).maybeSingle();
  if (!data) return null;
  const thumb = data.thumbnail_path ? supabase.storage.from("thumbnails").getPublicUrl(data.thumbnail_path).data.publicUrl : null;
  return { ...data, design: normalizeDesign(data.data), thumb };
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const d = await load(params.id);
  if (!d) return { title: "Ring not found" };
  return { title: `${d.name} · ${BRAND.name}`, description: describeDesign(d.design), openGraph: d.thumb ? { images: [d.thumb] } : undefined };
}

export default async function SharedDesign({ params }: { params: { id: string } }) {
  const d = await load(params.id);
  if (!d) notFound();
  const { data: auth } = await createClient().auth.getUser();
  const mine = auth.user?.id === d.owner;
  const copy = copyDesign.bind(null, d.id);
  return (
    <main className="page">
      <div style={{ display: "grid", gap: 8 }}>
        <h1 style={{ fontSize: 40 }}>{d.name}</h1>
        <p className="muted" style={{ margin: 0 }}>{describeDesign(d.design)}</p>
      </div>
      <RingViewer design={d.design} />
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {mine ? (
          <Link href={`/design/${d.id}`} className="btn primary">Edit this design</Link>
        ) : (
          <form action={copy}><button className="btn primary">Make my own version</button></form>
        )}
      </div>
    </main>
  );
}
