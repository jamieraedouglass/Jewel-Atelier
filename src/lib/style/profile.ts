import { z } from "zod";
import {
  GEMS, KARATS, METALS, SHAPES, STYLES, TYPE_LABEL, gemLabel, indianRingSize, isGold, label, matchingVariety, uses,
  type Design, type DesignPatch, type Gem, type PieceType,
} from "../design";

export const AESTHETICS = [
  "classic", "art-deco", "minimal", "statement", "bridal", "heritage", "polki-kundan", "contemporary", "floral", "geometric", "colourful",
] as const;
export const AESTHETIC_LABEL: Record<(typeof AESTHETICS)[number], string> = {
  classic: "Classic & timeless", "art-deco": "Art Deco & vintage", minimal: "Minimal & fine", statement: "Statement & maximalist",
  bridal: "Bridal", heritage: "Temple & heritage", "polki-kundan": "Polki & kundan", contemporary: "Contemporary",
  floral: "Floral & organic", geometric: "Geometric", colourful: "Colourful & playful",
};
export const OCCASIONS = ["everyday", "work", "evening", "festive", "bridal", "gifting"] as const;
export const DESIGNING_FOR = ["myself", "clients", "gift"] as const;
export const SCALES = ["delicate", "balanced", "statement"] as const;
export const UNDERTONES = ["warm", "cool", "neutral"] as const;
export const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED"] as const;

const many = <T extends readonly [string, ...string[]]>(values: T, max: number) => z.array(z.enum(values)).max(max).default([]);

export const StylePrefsSchema = z.object({
  designingFor: z.enum(DESIGNING_FOR).nullable().default(null),
  aesthetics: many(AESTHETICS, 6),
  metals: many(METALS, 5),
  karat: z.number().int().refine((k) => (KARATS as readonly number[]).includes(k)).nullable().default(null),
  loveGems: many(GEMS, 10),
  avoidGems: many(GEMS, 10),
  shapes: many(SHAPES, 8),
  scale: z.enum(SCALES).nullable().default(null),
  occasions: many(OCCASIONS, 6),
  undertone: z.enum(UNDERTONES).nullable().default(null),
  budget: z.object({ currency: z.enum(CURRENCIES).default("INR"), amount: z.number().positive().max(1e10).nullable().default(null) }).default({}),
  sizes: z.object({
    ringUs: z.number().min(3).max(13).nullable().default(null),
    wristCm: z.number().min(13).max(24).nullable().default(null),
    necklaceIn: z.number().min(12).max(40).nullable().default(null),
  }).default({}),
  avoid: z.string().max(800).default(""),
});
export type StylePrefs = z.output<typeof StylePrefsSchema>;

export function normalizePrefs(input: unknown): StylePrefs {
  const whole = StylePrefsSchema.safeParse(input ?? {});
  if (whole.success) return whole.data;
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(StylePrefsSchema.shape)) {
    const value = raw[key];
    if (key === "sizes" || key === "budget") {
      const inner = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
      const shape = (field as unknown as z.ZodDefault<z.ZodObject<z.ZodRawShape>>)._def.innerType.shape;
      out[key] = Object.fromEntries(Object.entries(shape).flatMap(([k, f]) => { const r = f.safeParse(inner[k]); return r.success ? [[k, r.data]] : []; }));
      continue;
    }
    const r = field.safeParse(value);
    if (r.success) out[key] = r.data;
  }
  return StylePrefsSchema.parse(out);
}

export type Taste = {
  designs: number;
  made: number;
  types: [PieceType, number][];
  styles: [string, number][];
  metals: [string, number][];
  gems: [string, number][];
  shapes: [string, number][];
  grades: [string, number][];
  moods?: [string, number][];
  ringUs: number | null;
  wristCm: number | null;
};

class Tally<K> {
  private m = new Map<K, { w: number; n: number }>();
  add(k: K, w: number, n = 1) { const e = this.m.get(k) ?? { w: 0, n: 0 }; e.w += w; e.n += n; this.m.set(k, e); }
  top(count: number): [K, number][] {
    return [...this.m].sort((a, b) => b[1].w - a[1].w || b[1].n - a[1].n || String(a[0]).localeCompare(String(b[0]))).slice(0, count).map(([k, e]) => [k, e.n]);
  }
}
const mostCommon = (xs: { v: number; w: number }[]) => {
  if (!xs.length) return null;
  const t = new Tally<number>();
  xs.forEach(({ v, w }) => t.add(v, w));
  return t.top(1)[0][0];
};

export function summarizeTaste(designs: Design[], weights?: number[], made = 0): Taste {
  const types = new Tally<PieceType>(), styles = new Tally<string>(), metals = new Tally<string>();
  const gems = new Tally<string>(), shapes = new Tally<string>(), grades = new Tally<string>(), moods = new Tally<string>();
  const rings: { v: number; w: number }[] = [], wrists: { v: number; w: number }[] = [];
  designs.forEach((d, i) => {
    const w = weights?.[i] ?? 1;
    types.add(d.type, w);
    styles.add(`${TYPE_LABEL[d.type]}: ${STYLES[d.type][d.style]?.label ?? d.style}`, w);
    metals.add(isGold(d.metal) ? `${d.purity.karat}k ${label(d.metal).toLowerCase()}` : label(d.metal).toLowerCase(), w);
    if (uses(d, "drop")) for (const part of d.drop.parts) if (part.showStone || part.kind === "stone") gems.add(part.stone.gem, w);
    if (uses(d, "center") && !d.center.none) {
      gems.add(d.center.gem, w * 2, 2);
      if (d.center.shape !== "round") shapes.add(d.center.shape, w);
      const g = matchingVariety(d.center.gem, d.center);
      if (g) grades.add(`${g.name} ${gemLabel(d.center.gem).toLowerCase()}`, w);
    }
    if (d.accents.enabled && d.accents.gem !== "diamond") gems.add(d.accents.gem, w);
    if (d.mood) moods.add(d.mood.toLowerCase(), w);
    if (d.type === "ring") rings.push({ v: d.ringSize, w });
    if (d.type === "bracelet") wrists.push({ v: d.options.wristCm, w });
  });
  return {
    designs: designs.length, made,
    types: types.top(4), styles: styles.top(5), metals: metals.top(3), gems: gems.top(6), shapes: shapes.top(4), grades: grades.top(3), moods: moods.top(4),
    ringUs: mostCommon(rings), wristCm: mostCommon(wrists),
  };
}

export function prefsFromTaste(t: Taste, current: StylePrefs): StylePrefs {
  if (t.designs < 2) return current;
  const often = (pairs: [string, number][], share = 0.25) => pairs.filter(([, n]) => n / t.designs >= share).map(([k]) => k);
  const metals = METALS.filter((m) => t.metals.some(([name, n]) => n / t.designs >= 0.25 && name.endsWith(label(m).toLowerCase())));
  const karatMatch = t.metals.map(([name]) => Number(name.match(/^(\d+)k/)?.[1])).find((k) => (KARATS as readonly number[]).includes(k));
  const loveGems = often(t.gems, 0.3).filter((g): g is Gem => (GEMS as readonly string[]).includes(g));
  const shapes = often(t.shapes, 0.25).filter((s): s is (typeof SHAPES)[number] => (SHAPES as readonly string[]).includes(s));
  return normalizePrefs({
    ...current,
    metals: current.metals.length ? current.metals : metals,
    karat: current.karat ?? karatMatch ?? null,
    loveGems: current.loveGems.length ? current.loveGems : loveGems.filter((g) => !current.avoidGems.includes(g)),
    shapes: current.shapes.length ? current.shapes : shapes,
    sizes: {
      ringUs: current.sizes.ringUs ?? t.ringUs,
      wristCm: current.sizes.wristCm ?? t.wristCm,
      necklaceIn: current.sizes.necklaceIn,
    },
  });
}

const list = (xs: readonly string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}` : xs[0] ?? "");
const metalWords = (m: (typeof METALS)[number]) => label(m).toLowerCase();
const counted = (pairs: [string, number][]) => list(pairs.map(([k, n]) => `${k} (${n})`));

export type ProfileInput = {
  prefs: StylePrefs; icons: string[]; notes: string; taste?: Taste | null; applied?: string[]; dismissed?: string[];
  photos?: number;
  photoRead?: string;
  owned?: { name: string; summary: string; notes: string }[];
};

export function describeProfile({ prefs: p, icons, notes, taste, applied = [], dismissed = [], photos = 0, photoRead = "", owned = [] }: ProfileInput): string {
  const lines: string[] = [];
  if (owned.length) lines.push(`Pieces they already own (suggest what complements these, don't repeat them): ${owned.slice(0, 20).map((o) => `${o.name} (${o.summary})${o.notes.trim() ? `: ${o.notes.trim().slice(0, 160)}` : ""}`).join("; ")}.`);
  if (p.designingFor === "clients") lines.push("They are a jeweller designing for clients: suggest options a client could choose between, and say who each suits.");
  if (p.designingFor === "gift") lines.push("They are designing a gift for someone else: favour wearable, versatile pieces and say why each would suit the wearer.");
  if (p.aesthetics.length) lines.push(`Their style: ${list(p.aesthetics.map((a) => AESTHETIC_LABEL[a].toLowerCase()))}.`);
  if (p.metals.length) lines.push(`Metals they wear: ${list(p.metals.map(metalWords))}${p.karat && p.metals.some(isGold) ? `, in ${p.karat}k gold` : ""}.`);
  else if (p.karat) lines.push(`Gold in ${p.karat}k.`);
  if (p.undertone) lines.push(`Skin undertone: ${p.undertone}${p.undertone === "warm" ? " (yellow and rose gold flatter)" : p.undertone === "cool" ? " (white gold and platinum flatter)" : " (any metal suits)"}.`);
  if (p.loveGems.length) lines.push(`Gems they love: ${list(p.loveGems.map((g) => gemLabel(g).toLowerCase()))}.`);
  if (p.shapes.length) lines.push(`Favourite shapes: ${list(p.shapes.map((s) => label(s).toLowerCase()))}.`);
  if (p.scale) lines.push(`Scale: ${p.scale === "delicate" ? "delicate, fine pieces" : p.scale === "balanced" ? "balanced, neither tiny nor dramatic" : "statement pieces with presence"}.`);
  if (p.occasions.length) lines.push(`Designing for: ${list(p.occasions)} wear.`);
  if (p.budget.amount) lines.push(`Budget: about ${p.budget.amount.toLocaleString("en-IN")} ${p.budget.currency} for a piece; keep stone sizes and metal weight realistic for it.`);
  const sizes = [
    p.sizes.ringUs ? `ring size US ${p.sizes.ringUs} (Indian ${indianRingSize(p.sizes.ringUs)})` : null,
    p.sizes.wristCm ? `wrist ${p.sizes.wristCm} cm` : null,
    p.sizes.necklaceIn ? `necklaces at ${p.sizes.necklaceIn}"` : null,
  ].filter((x): x is string => !!x);
  if (sizes.length) lines.push(`Sizes: ${list(sizes)}. Use them when proposing pieces.`);
  const avoid = [...p.avoidGems.map((g) => gemLabel(g).toLowerCase()), ...(p.avoid.trim() ? [p.avoid.trim()] : [])];
  if (avoid.length) lines.push(`AVOID (never suggest these): ${avoid.join("; ")}.`);
  if (icons.length) lines.push(`Style icons: ${list(icons)}.`);
  if (notes.trim()) lines.push(`Their notes: ${notes.trim()}`);
  if (photos) lines.push(`The ${photos} image(s) above are their inspiration photos.`);
  else if (photoRead.trim()) lines.push(`Their inspiration photos, as read by the studio: ${photoRead.trim()}`);
  if (taste && taste.designs >= 2) {
    const t: string[] = [`From the ${taste.designs} designs they have saved${taste.made ? ` (${taste.made} actually made, which count most)` : ""}, recent work weighted most:`];
    if (taste.types.length) t.push(`they mostly make ${counted(taste.types.map(([k, n]) => [TYPE_LABEL[k].toLowerCase(), n]))};`);
    if (taste.styles.length) t.push(`favourite styles ${counted(taste.styles)};`);
    if (taste.metals.length) t.push(`metals ${counted(taste.metals)};`);
    if (taste.gems.length) t.push(`stones ${counted(taste.gems.map(([g, n]) => [gemLabel(g).toLowerCase(), n]))};`);
    if (taste.grades.length) t.push(`colour grades ${counted(taste.grades)};`);
    if (taste.shapes.length) t.push(`shapes ${counted(taste.shapes)}.`);
    if (taste.moods?.length) t.push(`The feelings they have asked for: ${counted(taste.moods)}.`);
    lines.push(t.join(" ").replace(/;$/, "."));
  }
  if (applied.length) lines.push(`Suggestions they applied recently (build on these): ${applied.slice(0, 10).join("; ")}.`);
  if (dismissed.length) lines.push(`Suggestions they turned down (don't offer these again, and steer away from what they share): ${dismissed.slice(0, 10).join("; ")}.`);
  return lines.length ? ["STYLE PROFILE", ...lines].join("\n") : "";
}

export function designDefaultsFrom(p: StylePrefs): DesignPatch {
  const patch: DesignPatch = {};
  if (p.metals.length) patch.metal = p.metals[0];
  if (p.karat) patch.purity = { karat: p.karat as (typeof KARATS)[number] };
  if (p.sizes.ringUs) patch.ringSize = p.sizes.ringUs;
  const options: DesignPatch["options"] = {};
  if (p.sizes.wristCm) options.wristCm = p.sizes.wristCm;
  if (p.sizes.necklaceIn) options.lengthIn = p.sizes.necklaceIn;
  if (Object.keys(options).length) patch.options = options;
  return patch;
}

export function profileCompleteness(p: StylePrefs, icons: string[], notes: string, photos: number) {
  const parts = [p.aesthetics.length, p.metals.length, p.loveGems.length, p.shapes.length, p.scale, p.occasions.length, p.sizes.ringUs ?? p.sizes.wristCm, icons.length || notes.trim(), photos];
  return parts.filter(Boolean).length / parts.length;
}
