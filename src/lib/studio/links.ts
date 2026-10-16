import { z } from "zod";
import {
  GEMS, GEM_LOOK, KARATS, METALS, SHAPES, gemLabel, indianRingSize, label, lengthForShape, metalName, normalizeDesign,
  varietiesOf, varietyLook, type Design, type Gem,
} from "../design";

/**
 * Client links: Carl sends one or more designs to a client as an unguessable link. The client can adjust only what
 * Carl allows (sizes, his choice of stones and shapes, metal and karat), on their own copy; Carl's design never changes.
 */

/** a centre stone the client may choose: a gem, optionally in one of its colour grades (Burmese ruby, Colombian emerald…) */
export const StoneOptionSchema = z.object({ gem: z.enum(GEMS), grade: z.string().max(30).optional() });
export type StoneOption = z.infer<typeof StoneOptionSchema>;

export const AllowSchema = z.object({
  /** ring size, wrist, necklace length, bangle size */
  sizes: z.boolean().default(true),
  /** centre stones to choose between (the design's own stone is always allowed) */
  stones: z.array(StoneOptionSchema).max(12).default([]),
  /** centre stone shapes to choose between */
  shapes: z.array(z.enum(SHAPES)).max(12).default([]),
  /** how much bigger or smaller the centre stone may go, as a share of its size (0.25 = ±25%) */
  stoneScale: z.number().min(0).max(0.6).default(0.25),
  metals: z.array(z.enum(METALS)).max(5).default([]),
  karats: z.array(z.number().int().refine((k) => (KARATS as readonly number[]).includes(k))).max(4).default([]),
  /** whether the client can ask the AI designer for help */
  chat: z.boolean().default(true),
});
export type Allow = z.output<typeof AllowSchema>;

export const normalizeAllow = (x: unknown): Allow => { const r = AllowSchema.safeParse(x ?? {}); return r.success ? r.data : AllowSchema.parse({}); };

/** the look a stone option gives the centre stone */
export function optionLook(o: StoneOption) {
  const v = o.grade ? varietiesOf(o.gem).find((x) => x.id === o.grade) : undefined;
  return v ? { ...varietyLook(v), label: `${v.name} ${gemLabel(o.gem).toLowerCase()}` } : { ...GEM_LOOK[o.gem], label: gemLabel(o.gem) };
}
export const optionName = (o: StoneOption) => optionLook(o).label;

const same = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round1 = (n: number) => Math.round(n * 10) / 10;
/** A stone's size for people to read: "10.8 × 9.8". */
export const sizeText = (s: { lengthMm: number; widthMm: number }) => `${round1(s.lengthMm)} × ${round1(s.widthMm)}`;

/**
 * The client's version of a design: Carl's design with only the allowed changes taken from what the client sent.
 * Whatever arrives (a tampered request, an AI suggestion), nothing else can change.
 */
export function clampToAllowed(base: Design, proposed: Design, allow: Allow): Design {
  const out: Design = JSON.parse(JSON.stringify(base));
  if (allow.sizes) {
    out.ringSize = proposed.ringSize;
    out.options.wristCm = proposed.options.wristCm;
    out.options.lengthIn = proposed.options.lengthIn;
    out.options.bangleSize = proposed.options.bangleSize;
  }
  if (proposed.metal === base.metal || allow.metals.includes(proposed.metal)) out.metal = proposed.metal;
  if (proposed.purity.karat === base.purity.karat || allow.karats.includes(proposed.purity.karat)) out.purity = { karat: proposed.purity.karat };

  if (!base.center.none) {
    const c = base.center, p = proposed.center;
    // the stone: the design's own, or one of Carl's options (in exactly that option's look)
    const option = allow.stones.find((o) => o.gem === p.gem && (o.grade ? optionLook(o).color.toLowerCase() === p.color.toLowerCase() : true));
    const ownStone = p.gem === c.gem && p.color.toLowerCase() === c.color.toLowerCase();
    if (!ownStone && option) {
      const look = optionLook(option);
      Object.assign(out.center, { gem: option.gem, color: look.color, clarity: look.clarity, glow: look.glow, label: look.label });
    }
    // the shape: its own or one Carl allows
    const shape = p.shape === c.shape || allow.shapes.includes(p.shape) ? p.shape : c.shape;
    out.center.shape = shape;
    // the size: within Carl's range of the original
    const r = allow.stoneScale;
    const width = clamp(p.widthMm, c.widthMm * (1 - r), c.widthMm * (1 + r));
    const length = shape === c.shape ? clamp(p.lengthMm, c.lengthMm * (1 - r), c.lengthMm * (1 + r)) : lengthForShape(width, shape);
    out.center.widthMm = round1(width);
    out.center.lengthMm = round1(length);
    const k = out.center.widthMm / c.widthMm;
    out.center.domeMm = Math.max(0.2, round1(c.domeMm * k));
    // the stated weight no longer holds once the stone changes; the spec sheet estimates it from the size
    if (out.center.gem !== c.gem || shape !== c.shape || !same(out.center.widthMm, c.widthMm) || !same(out.center.lengthMm, c.lengthMm)) out.center.carat = null;
  }
  return normalizeDesign(out);
}

/** what the client changed, in plain words, for Carl and the dashboard */
export function describeChanges(base: Design, v: Design): string[] {
  const out: string[] = [];
  if (base.type === "ring" && base.ringSize !== v.ringSize) out.push(`Ring size US ${base.ringSize} → ${v.ringSize} (Indian ${indianRingSize(v.ringSize)})`);
  if (base.options.wristCm !== v.options.wristCm && base.type === "bracelet") out.push(`Wrist ${base.options.wristCm} → ${v.options.wristCm} cm`);
  if (base.options.bangleSize !== v.options.bangleSize && base.type === "bracelet") out.push(`Bangle size ${base.options.bangleSize} → ${v.options.bangleSize}`);
  if (base.options.lengthIn !== v.options.lengthIn && base.type === "necklace") out.push(`Length ${base.options.lengthIn}" → ${v.options.lengthIn}"`);
  if (base.metal !== v.metal || base.purity.karat !== v.purity.karat) out.push(`Metal ${metalName(base)} → ${metalName(v)}`);
  if (!base.center.none) {
    const a = base.center, b = v.center;
    if (a.gem !== b.gem || a.color.toLowerCase() !== b.color.toLowerCase()) out.push(`Centre stone ${a.label || gemLabel(a.gem)} → ${b.label || gemLabel(b.gem)}`);
    if (a.shape !== b.shape) out.push(`Shape ${label(a.shape).toLowerCase()} → ${label(b.shape).toLowerCase()}`);
    if (!same(a.lengthMm, b.lengthMm) || !same(a.widthMm, b.widthMm)) out.push(`Stone size ${sizeText(a)} → ${sizeText(b)} mm`);
  }
  return out;
}

/** what the AI designer may suggest on a client link, so it stays within what Carl allowed */
export function allowText(allow: Allow, base: Design): string {
  const can: string[] = [];
  if (allow.sizes) can.push("sizes (ring size, wrist, necklace length, bangle size)");
  if (!base.center.none) {
    if (allow.stones.length) can.push(`the centre stone, choosing only from: ${allow.stones.map(optionName).join(", ")} (or keeping ${base.center.label || gemLabel(base.center.gem)})`);
    if (allow.shapes.length) can.push(`the centre stone's shape, only: ${allow.shapes.map((s) => label(s).toLowerCase()).join(", ")}`);
    if (allow.stoneScale > 0) can.push(`the centre stone's size, up to ${Math.round(allow.stoneScale * 100)}% bigger or smaller`);
  }
  if (allow.metals.length) can.push(`the metal: ${allow.metals.map((m) => label(m).toLowerCase()).join(", ")}`);
  if (allow.karats.length) can.push(`the karat: ${allow.karats.map((k) => `${k}k`).join(", ")}`);
  return `This is a CLIENT of the jeweller, looking at a design the jeweller sent them. Speak to them warmly and simply, as the house would.
Only propose changes to: ${can.length ? can.join("; ") : "nothing (the design is fixed: just answer questions)"}.
For anything else (a different setting, more stones, a new design), don't propose it: suggest they press "Ask the jeweller" to request it.
Never quote prices; say the jeweller will confirm the price.`;
}

/** where a link stands */
export function linkState(link: { revoked: boolean; expires_at: string | null }, now = Date.now()): "active" | "expired" | "revoked" {
  if (link.revoked) return "revoked";
  if (link.expires_at && Date.parse(link.expires_at) < now) return "expired";
  return "active";
}

export const CreateLinkSchema = z.object({
  clientName: z.string().trim().min(1).max(80),
  note: z.string().max(1000).default(""),
  designIds: z.array(z.string().uuid()).min(1).max(8),
  allow: AllowSchema,
  expiresInDays: z.number().int().min(0).max(365).default(30),
  aiDailyLimit: z.number().int().min(0).max(200).default(20),
});
export type CreateLink = z.input<typeof CreateLinkSchema>;

export const isGem = (g: string): g is Gem => (GEMS as readonly string[]).includes(g);
