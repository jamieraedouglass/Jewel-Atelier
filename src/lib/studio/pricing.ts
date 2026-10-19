import { z } from "zod";
import { KARATS, METALS, SHAPES, isGold, label, lengthForShape, metalName, normalizeDesign, round1, type Design } from "../design";
import { FRESH_STONE, StoneOptionSchema, clampToAllowed, optionLook, optionName, type Allow } from "./links";

export const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "SGD", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_NAMES: Record<Currency, string> = {
  INR: "Indian rupees (₹)", USD: "US dollars ($)", GBP: "British pounds (£)", EUR: "Euros (€)", AED: "UAE dirhams (AED)",
  SGD: "Singapore dollars (S$)", CAD: "Canadian dollars (C$)", AUD: "Australian dollars (A$)",
};

const PriceVersionSchema = z.object({
  inr: z.number().int().positive().max(10_000_000_000),
  stone: StoneOptionSchema.optional(),
  shape: z.enum(SHAPES).optional(),
  metal: z.enum(METALS).optional(),
  karat: z.number().int().refine((k) => (KARATS as readonly number[]).includes(k)).optional(),
});
export type PriceVersion = z.infer<typeof PriceVersionSchema>;

export const PricingSchema = z.object({
  currency: z.enum(CURRENCIES).default("INR"),
  pieces: z.record(z.string(), z.array(PriceVersionSchema).max(12)).default({}),
});
export type Pricing = z.output<typeof PricingSchema>;

export const normalizePricing = (x: unknown): Pricing => { const r = PricingSchema.safeParse(x ?? {}); return r.success ? r.data : PricingSchema.parse({}); };


function versionDesign(base: Design, v: Omit<PriceVersion, "inr">): Design {
  const d: Design = JSON.parse(JSON.stringify(base));
  if (!base.center.none) {
    if (v.stone) {
      const look = optionLook(v.stone);
      Object.assign(d.center, { gem: v.stone.gem, color: look.color, clarity: look.clarity, glow: look.glow, label: look.label, carat: null, ...FRESH_STONE });
    }
    if (v.shape && v.shape !== base.center.shape) {
      d.center.shape = v.shape;
      d.center.lengthMm = round1(lengthForShape(base.center.widthMm, v.shape));
      d.center.carat = null;
    }
  }
  if (v.metal) d.metal = v.metal;
  if (v.karat) d.purity = { karat: v.karat as Design["purity"]["karat"] };
  return normalizeDesign(d);
}

const priceKey = (d: Design) => [
  d.center.none ? "-" : `${d.center.gem}|${d.center.color.toLowerCase()}|${d.center.shape}|${round1(d.center.widthMm)}|${round1(d.center.lengthMm)}`,
  d.metal, isGold(d.metal) ? d.purity.karat : "",
].join("/");

export function priceFor(base: Design, current: Design, versions: PriceVersion[] | undefined): PriceVersion | null {
  if (!versions?.length) return null;
  const k = priceKey(current);
  return versions.find((v) => priceKey(versionDesign(base, v)) === k) ?? null;
}

export function applyVersion(base: Design, current: Design, v: PriceVersion): Design {
  const d = versionDesign(base, v);
  return normalizeDesign({ ...d, ringSize: current.ringSize, options: { ...d.options, wristCm: current.options.wristCm, lengthIn: current.options.lengthIn, bangleSize: current.options.bangleSize } });
}

export function cleanPricing(input: Pricing, bases: Record<string, Design>, allow: Allow): Pricing {
  const pieces: Pricing["pieces"] = {};
  for (const [id, versions] of Object.entries(input.pieces)) {
    const base = bases[id];
    if (!base) continue;
    const byKey = new Map<string, PriceVersion>();
    for (const v of versions) {
      const d = versionDesign(base, v);
      if (priceKey(clampToAllowed(base, d, allow)) !== priceKey(d)) continue;
      byKey.set(priceKey(d), v);
    }
    if (byKey.size) pieces[id] = [...byKey.values()];
  }
  return { currency: input.currency, pieces };
}

export function versionName(base: Design, v: Omit<PriceVersion, "inr">): string {
  const parts: string[] = [];
  if (v.stone) parts.push(optionName(v.stone));
  if (v.shape && v.shape !== base.center.shape) parts.push(label(v.shape).toLowerCase());
  if (v.metal || v.karat) parts.push(metalName(versionDesign(base, v)));
  return parts.length ? parts.join(" · ") : "As designed";
}

export function formatMoney(amount: number, currency: Currency): string {
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

export function priceText(inr: number, currency: Currency, rate: number | null): { main: string; sub: string | null } {
  if (currency === "INR" || !rate) return { main: formatMoney(inr, "INR"), sub: null };
  return { main: `≈ ${formatMoney(inr * rate, currency)}`, sub: `${formatMoney(inr, "INR")}, converted at today's rate` };
}

export function knownPriceReply(studio: string, pieceName: string, inr: number, currency: Currency, rate: number | null) {
  const { main, sub } = priceText(inr, currency, rate);
  const whose = studio.endsWith("s") ? `${studio}'` : `${studio}'s`;
  return `${whose} price for the ${pieceName} as you've set it up is ${main}${sub ? ` (${sub}; the price itself is in rupees)` : ""}. It's confirmed when you order, so use "Ask the jeweller" when you're ready or if you'd like anything changed.`;
}
