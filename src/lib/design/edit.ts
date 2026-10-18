import { type PieceType, STYLES, firstStyle, hasStyle } from "./styles";
import { type Design, DesignSchema, DropPartSchema, defaultDesign } from "./schema";
import { clamp, round1 } from "./measures";
import { buildable } from "./buildRules";

const HOOPS = new Set(["hoop", "huggie"]);
export function rightEarDesign(d: Design): Design {
  const raw = (d.rightEar ?? {}) as Record<string, unknown>;
  let style = typeof raw.style === "string" ? raw.style : d.style;
  if (HOOPS.has(d.style) !== HOOPS.has(style) || !hasStyle("earrings", style)) style = d.style;
  const r = DesignSchema.safeParse({ ...raw, type: "earrings", style, metal: d.metal, purity: d.purity, rightEar: null, name: d.name });
  return r.success ? r.data : { ...d, rightEar: null };
}
export function asRightEar(r: Design): Record<string, unknown> {
  const { rightEar: _r, name: _n, type: _t, ...rest } = r;
  void _r; void _n; void _t;
  return rest as Record<string, unknown>;
}

export function normalizeDesign(input: unknown): Design {
  const r = parseRepaired(input ?? {});
  return r.data ? buildable(r.data) : defaultDesign();
}

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };
export type DesignPatch = DeepPartial<Design>;

export function applyPatch(design: Design, patch: DesignPatch): Design {
  const merged: Record<string, unknown> = { ...design };
  for (const [k, v] of Object.entries(patch)) {
    const cur = (design as Record<string, unknown>)[k];
    merged[k] = v && typeof v === "object" && !Array.isArray(v) && cur && typeof cur === "object" ? { ...cur, ...v } : v;
  }
  const r = parseRepaired(merged);
  return r.data ? buildable(r.data) : design;
}

type Path = (string | number)[];
const getAt = (o: unknown, path: Path) => path.reduce<unknown>((x, k) => (x && typeof x === "object" ? (x as Record<string | number, unknown>)[k] : undefined), o);
function setAt(o: unknown, path: Path, value: unknown, remove = false) {
  const parent = getAt(o, path.slice(0, -1));
  const k = path[path.length - 1];
  if (!parent || typeof parent !== "object") return false;
  if (remove) {
    if (Array.isArray(parent) && typeof k === "number") parent.splice(k, 1);
    else delete (parent as Record<string | number, unknown>)[k];
  } else (parent as Record<string | number, unknown>)[k] = value;
  return true;
}

export function parseRepaired(input: unknown): { data: Design | null; fixes: string[] } {
  const cur: unknown = input && typeof input === "object" ? structuredClone(input) : input;
  const fixes: string[] = [];
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = DesignSchema.safeParse(cur);
    if (r.success) return { data: r.data, fixes };
    let changed = false;
    const seen = new Set<string>();
    for (const iss of r.error.issues) {
      const path = iss.path as Path, id = path.join(".");
      if (!path.length || seen.has(id)) continue;
      seen.add(id);
      const here = getAt(cur, path);
      if ((iss.code === "too_small" || iss.code === "too_big") && typeof here === "number") {
        const bound = Number(iss.code === "too_small" ? iss.minimum : iss.maximum);
        const nudge = iss.inclusive ? 0 : (iss.code === "too_small" ? 1e-6 : -1e-6);
        changed = setAt(cur, path, bound + nudge) || changed;
      } else if (iss.code === "too_big" && Array.isArray(here)) {
        here.length = Number(iss.maximum); changed = true;
      } else if (iss.code === "too_big" && typeof here === "string") {
        changed = setAt(cur, path, here.slice(0, Number(iss.maximum))) || changed;
      } else {
        changed = setAt(cur, path, undefined, true) || changed;
      }
      fixes.push(id);
    }
    if (!changed) break;
  }
  return { data: null, fixes };
}

const STONE_MAX: Record<PieceType, number> = { ring: 40, earrings: 11, necklace: 22, bracelet: 14, anklet: 6, headpiece: 16, nose: 5, armlet: 16, hand: 12, mens: 12 };
const STYLE_STONE_MAX: Record<string, number> = { riviera: 6.5, station: 6, "kundan-choker": 9, collar: 9, charm: 6, "station-anklet": 5, chandelier: 7, tassel: 7, jhumka: 8, chandbali: 9, temple: 9, mangalsutra: 10 };

export function chooseStyle(design: Design, type: PieceType, style?: string): Design {
  const s = style && hasStyle(type, style) ? style : firstStyle(type);
  let next = applyPatch(applyPatch(design, { type, style: s }), STYLES[type][s].defaults ?? {});
  if (s === "three-stone" && next.sides.kind === "none") next = applyPatch(next, { sides: { kind: "half-moon" } });
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
