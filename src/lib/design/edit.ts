import { type PieceType, STYLES, firstStyle, hasStyle } from "./styles";
import { type Design, DesignSchema, DropPartSchema, defaultDesign } from "./schema";
import { clamp, round1 } from "./measures";
import { buildable } from "./buildRules";

/** Changing a design: patches, style switches and the right earring of an odd pair. */

const HOOPS = new Set(["hoop", "huggie"]);
/**
 * The right earring when the pair isn't matching. Metal and karat always follow the pair; hoops and huggies
 * stay hoops on both sides (they are built standing up, the other styles lie flat).
 */
export function rightEarDesign(d: Design): Design {
  const raw = (d.rightEar ?? {}) as Record<string, unknown>;
  let style = typeof raw.style === "string" ? raw.style : d.style;
  if (HOOPS.has(d.style) !== HOOPS.has(style) || !hasStyle("earrings", style)) style = d.style;
  const r = DesignSchema.safeParse({ ...raw, type: "earrings", style, metal: d.metal, purity: d.purity, rightEar: null, name: d.name });
  return r.success ? r.data : { ...d, rightEar: null };
}
/** what gets stored as the right earring */
export function asRightEar(r: Design): Record<string, unknown> {
  const { rightEar: _r, name: _n, type: _t, ...rest } = r;
  void _r; void _n; void _t;
  return rest as Record<string, unknown>;
}

/** Parse anything (DB row, AI output) into a complete, valid design. */
export function normalizeDesign(input: unknown): Design {
  const r = DesignSchema.safeParse(input ?? {});
  // anything that can't actually be made is corrected (see buildRules)
  return r.success ? buildable(r.data) : defaultDesign();
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type DesignPatch = DeepPartial<Design>;

/** Merge a partial change (from a control or from the AI) into a design. */
export function applyPatch(design: Design, patch: DesignPatch): Design {
  const merged: Record<string, unknown> = { ...design };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (design as Record<string, unknown>)[k];
    merged[k] = v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" ? { ...cur, ...v } : v;
  }
  const r = DesignSchema.safeParse(merged);
  return r.success ? buildable(r.data) : design;
}

/** largest sensible main stone (mm, longest side) for each type; specific styles override */
const STONE_MAX: Record<PieceType, number> = { ring: 40, earrings: 11, necklace: 22, bracelet: 14, anklet: 6, headpiece: 16, nose: 5, armlet: 16, hand: 12, mens: 12 };
const STYLE_STONE_MAX: Record<string, number> = { riviera: 6.5, station: 6, "kundan-choker": 9, collar: 9, charm: 6, "station-anklet": 5, chandelier: 7, tassel: 7, jhumka: 8, chandbali: 9, temple: 9, mangalsutra: 10 };

/** Switch type and/or style, applying that style's defaults and scaling an oversized main stone to suit. */
export function chooseStyle(design: Design, type: PieceType, style?: string): Design {
  const s = style && hasStyle(type, style) ? style : firstStyle(type);
  let next = applyPatch(applyPatch(design, { type, style: s }), STYLES[type][s].defaults ?? {});
  // styles that need side stones get them back if an earlier style switched them off
  if (s === "three-stone" && next.sides.kind === "none") next = applyPatch(next, { sides: { kind: "half-moon" } });
  // a two-stone ring needs its second stone
  if (s === "two-stone" && next.extraStones.length === 0)
    next = applyPatch(next, { extraStones: [{ gem: "diamond", cut: "faceted", shape: "pear", lengthMm: clamp(next.center.lengthMm * 0.8, 6, 30), widthMm: clamp(next.center.widthMm * 0.7, 4, 30), domeMm: 0.8, color: "#f4f6fb", clarity: 0.95, rotation: 0, dx: 0, dz: 0 }] } as DesignPatch);
  const max = STYLE_STONE_MAX[s] ?? STONE_MAX[type];
  const c = next.center, longest = Math.max(c.lengthMm, c.widthMm);
  if (longest > max) {
    const k = max / longest;
    next = applyPatch(next, { center: { lengthMm: Math.max(1, round1(c.lengthMm * k)), widthMm: Math.max(1, round1(c.widthMm * k)), domeMm: Math.max(0.2, round1(c.domeMm * k)), carat: null } });
  }
  return next;
}

/**
 * applyPatch, but one bad value doesn't throw away the rest: if the whole patch doesn't validate, each top-level field is
 * tried on its own, and drop parts one by one. Used for changes proposed by the AI, which can stray out of range.
 */
export function applyPatchLenient(design: Design, patch: DesignPatch): Design {
  const whole = applyPatch(design, patch);
  if (whole !== design) return whole;
  let d = design;
  for (const [k, v] of Object.entries(patch)) {
    if (k === "drop" && v && typeof v === "object") {
      const { parts: rawParts, ...rest } = v as { parts?: unknown[] };
      const parts = (Array.isArray(rawParts) ? rawParts : []).flatMap((x) => { const r = DropPartSchema.safeParse(x); return r.success ? [r.data] : []; });
      d = applyPatch(d, { drop: { ...rest, ...(parts.length ? { parts } : {}) } } as DesignPatch);
    } else d = applyPatch(d, { [k]: v } as DesignPatch);
  }
  return d;
}
