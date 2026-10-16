import Link from "next/link";
import { redirect } from "next/navigation";
import { describeDesign, normalizeDesign } from "@/lib/design";
import { normalizeInventory, type InventoryRow } from "@/lib/inventory";
import { requireUser } from "@/lib/supabase/server";
import InventoryTable from "@/components/inventory/InventoryTable";

export const metadata = { title: "Inventory · Atelier" };

/** Every piece marked as made: what it is, where it is, what it weighs and what it's worth. */
export default async function InventoryPage() {
  const { supabase, user } = await requireUser();
  if (!user) redirect("/login?next=/inventory");
  const { data, error } = await supabase.from("designs").select("id, name, data, made_at, inventory, thumbnail_path")
    .eq("owner", user.id).eq("status", "made").order("made_at", { ascending: false, nullsFirst: false });
  const rows: (InventoryRow & { thumb: string | null })[] = (data ?? []).map((r) => ({
    id: r.id, name: r.name, madeAt: r.made_at, inventory: normalizeInventory(r.inventory), summary: describeDesign(normalizeDesign(r.data)),
    thumb: r.thumbnail_path ? supabase.storage.from("thumbnails").getPublicUrl(r.thumbnail_path).data.publicUrl : null,
  }));
  return (
    <main className="page" style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 40, margin: 0 }}>Inventory</h1>
        <Link href="/rings" className="btn">All designs</Link>
      </div>
      {error ? (
        <p className="error">The inventory needs a database update: run supabase/migrations/20261017_tracking_inventory_feedback.sql in Supabase, then reload.</p>
      ) : !rows.length ? (
        <p className="muted">Nothing here yet. Open a design and mark it <b>Made</b> once it&apos;s been made; it will appear here to track its weight, price and where it is.</p>
      ) : (
        <InventoryTable rows={rows} />
      )}
    </main>
  );
}
