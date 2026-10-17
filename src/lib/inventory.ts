import { z } from "zod";
import { CURRENCIES } from "./style/profile";

export const STATUSES = ["idea", "workshop", "made"] as const;
export type Status = (typeof STATUSES)[number];
export const STATUS_LABEL: Record<Status, string> = { idea: "Idea", workshop: "In the workshop", made: "Made" };
export const normalizeStatus = (s: unknown): Status => ((STATUSES as readonly unknown[]).includes(s) ? (s as Status) : "idea");

export const AVAILABILITY = ["in-stock", "reserved", "with-client", "sold"] as const;
export const AVAILABILITY_LABEL: Record<(typeof AVAILABILITY)[number], string> = { "in-stock": "In stock", reserved: "Reserved", "with-client": "With a client", sold: "Sold" };

export const InventorySchema = z.object({
  ref: z.string().max(40).default(""),
  weightG: z.number().positive().max(10000).nullable().default(null),
  stonesCt: z.number().positive().max(10000).nullable().default(null),
  price: z.number().nonnegative().max(1e11).nullable().default(null),
  cost: z.number().nonnegative().max(1e11).nullable().default(null),
  currency: z.enum(CURRENCIES).default("INR"),
  availability: z.enum(AVAILABILITY).default("in-stock"),
  client: z.string().max(80).default(""),
  notes: z.string().max(1000).default(""),
});
export type Inventory = z.output<typeof InventorySchema>;

export function normalizeInventory(input: unknown): Inventory {
  const whole = InventorySchema.safeParse(input ?? {});
  if (whole.success) return whole.data;
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, f] of Object.entries(InventorySchema.shape)) { const r = f.safeParse(raw[k]); if (r.success) out[k] = r.data; }
  return InventorySchema.parse(out);
}

export type InventoryRow = { id: string; name: string; madeAt: string | null; inventory: Inventory; summary: string };

export function inventoryTotals(rows: InventoryRow[]) {
  const value = new Map<string, { stock: number; sold: number }>();
  let weightG = 0, stonesCt = 0, inStock = 0, sold = 0;
  for (const { inventory: i } of rows) {
    if (i.availability === "sold") sold++; else inStock++;
    if (i.availability !== "sold") { weightG += i.weightG ?? 0; stonesCt += i.stonesCt ?? 0; }
    if (i.price != null) {
      const v = value.get(i.currency) ?? { stock: 0, sold: 0 };
      if (i.availability === "sold") v.sold += i.price; else v.stock += i.price;
      value.set(i.currency, v);
    }
  }
  return { pieces: rows.length, inStock, sold, weightG: Math.round(weightG * 100) / 100, stonesCt: Math.round(stonesCt * 100) / 100, value: [...value].sort(([a], [b]) => a.localeCompare(b)) };
}

const cell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function inventoryCsv(rows: InventoryRow[]) {
  const head = ["Reference", "Name", "Made", "Availability", "Client", "Metal weight (g)", "Stones (ct)", "Cost", "Price", "Currency", "Description", "Notes"];
  const lines = rows.map(({ name, madeAt, inventory: i, summary }) => [
    i.ref, name, madeAt?.slice(0, 10) ?? "", AVAILABILITY_LABEL[i.availability], i.client, i.weightG, i.stonesCt, i.cost, i.price, i.currency, summary, i.notes,
  ].map(cell).join(","));
  return [head.join(","), ...lines].join("\n") + "\n";
}

export function tasteWeight(status: Status, updatedAt: string | null | undefined, now = Date.now()) {
  const base = status === "made" ? 3 : status === "workshop" ? 2 : 1;
  const ageDays = updatedAt ? Math.max(0, (now - new Date(updatedAt).getTime()) / 86_400_000) : 0;
  return base * Math.max(0.2, Math.pow(0.5, ageDays / 180));
}
