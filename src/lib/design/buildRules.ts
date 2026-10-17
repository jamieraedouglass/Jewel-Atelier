import type { Design } from "./schema";

/**
 * What can actually be made. Some combinations look possible on screen but can't be built or worn, so they aren't
 * offered (the control is greyed out with the reason) and a design that has one is quietly corrected to the nearest
 * thing that can be made. Each rule says why, in a jeweller's words.
 */

/** side stones fitted tight against the centre need a straight edge to sit against it (half-moons, trapezoids, baguettes) */
export const SIDES_THAT_HUG = new Set(["half-moon", "trapezoid", "baguette"]);
export const canHug = (kind: Design["sides"]["kind"]) => SIDES_THAT_HUG.has(kind);
export const HUG_REASON = "Only stones with a straight edge (half-moons, trapezoids, baguettes) can be fitted tight against the centre stone.";

/** a huggie hugs the lobe: stones on the inside would press into it */
export const HUGGIE_INSIDE_REASON = "A huggie sits against the earlobe, so stones on the inside would press into it.";

/** toi-et-moi stones can touch only without a surround: the two surrounds would run into each other */
export const TOUCHING_SURROUND_REASON = "Touching stones can't each have their own surround: the surrounds would run into each other.";

export type Blocked = { reason: string };

/** what this design doesn't allow, by control, with the reason (for greying out options) */
export function blockedOptions(d: Design) {
  return {
    hug: canHug(d.sides.kind) ? null : { reason: HUG_REASON },
    hoopInside: d.type === "earrings" && d.style === "huggie" ? { reason: HUGGIE_INSIDE_REASON } : null,
    pairTouching: d.type === "ring" && d.style === "two-stone" && d.options.halo ? { reason: TOUCHING_SURROUND_REASON } : null,
  };
}

/** a design with anything that can't be made corrected to the nearest thing that can (returns the same object when fine) */
export function buildable(d: Design): Design {
  let out = d;
  const set = (patch: (x: Design) => Design) => { out = patch(out); };
  if (out.sides.hug && !canHug(out.sides.kind)) set((x) => ({ ...x, sides: { ...x.sides, hug: false } }));
  if (out.type === "earrings" && out.style === "huggie" && out.options.hoopFace === "inner") set((x) => ({ ...x, options: { ...x.options, hoopFace: "front" } }));
  if (out.type === "ring" && out.style === "two-stone" && out.options.halo && out.options.pairSpacing === "touching") set((x) => ({ ...x, options: { ...x.options, pairSpacing: "apart" } }));
  return out;
}
