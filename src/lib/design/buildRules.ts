import type { Design } from "./schema";

export const SIDES_THAT_HUG = new Set(["half-moon", "trapezoid", "baguette"]);
export const canHug = (kind: Design["sides"]["kind"]) => SIDES_THAT_HUG.has(kind);
export const HUG_REASON = "Only stones with a straight edge (half-moons, trapezoids, baguettes) can be fitted tight against the centre stone.";

export const HUGGIE_INSIDE_REASON = "A huggie sits against the earlobe, so stones on the inside would press into it.";

export const TOUCHING_SURROUND_REASON = "Touching stones can't each have their own surround: the surrounds would run into each other.";

export type Blocked = { reason: string };

export function blockedOptions(d: Design) {
  return {
    hug: canHug(d.sides.kind) ? null : { reason: HUG_REASON },
    hoopInside: d.type === "earrings" && d.style === "huggie" ? { reason: HUGGIE_INSIDE_REASON } : null,
    pairTouching: d.type === "ring" && d.style === "two-stone" && d.options.halo ? { reason: TOUCHING_SURROUND_REASON } : null,
  };
}

export function buildable(d: Design): Design {
  let out = d;
  const set = (patch: (x: Design) => Design) => { out = patch(out); };
  if (out.sides.hug && !canHug(out.sides.kind)) set((x) => ({ ...x, sides: { ...x.sides, hug: false } }));
  if (out.type === "earrings" && out.style === "huggie" && out.options.hoopFace === "inner") set((x) => ({ ...x, options: { ...x.options, hoopFace: "front" } }));
  if (out.type === "ring" && out.style === "two-stone" && out.options.halo && out.options.pairSpacing === "touching") set((x) => ({ ...x, options: { ...x.options, pairSpacing: "apart" } }));
  return out;
}
