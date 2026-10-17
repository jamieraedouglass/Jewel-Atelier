import { DesignSchema, type Design } from "./design";
import { normalizeInventory, normalizeStatus, type Inventory, type Status } from "./inventory";

export type BackupRow = { data: Design; name: string; status?: Status; made_at?: string | null; inventory?: Inventory };

export function backupRows(json: string): { rows: BackupRow[]; skipped: number } | { error: string } {
  let parsed: unknown;
  try { parsed = JSON.parse(json); } catch { return { error: "That file isn't a designs backup." }; }
  const list = parsed && typeof parsed === "object" && Array.isArray((parsed as { designs?: unknown }).designs) ? (parsed as { designs: unknown[] }).designs.slice(0, 500) : [];
  const rows: BackupRow[] = [];
  let skipped = 0;
  for (const x of list) {
    const entry = (x && typeof x === "object" ? x : {}) as { data?: unknown; status?: unknown; made_at?: unknown; inventory?: unknown };
    const r = DesignSchema.safeParse(entry.data);
    if (!r.success) { skipped++; continue; }
    const data = { ...r.data, center: { ...r.data.center, photoPath: null } };
    const tracked = entry.status !== undefined
      ? { status: normalizeStatus(entry.status), made_at: typeof entry.made_at === "string" ? entry.made_at : null, inventory: normalizeInventory(entry.inventory) }
      : {};
    rows.push({ data, name: data.name, ...tracked });
  }
  if (!rows.length) return { error: skipped ? "None of the designs in that file could be read." : "No designs found in that file." };
  return { rows, skipped };
}
