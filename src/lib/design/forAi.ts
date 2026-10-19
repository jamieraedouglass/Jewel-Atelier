import { describeDesign } from "./describe";
import type { Design } from "./schema";
import { uses } from "./styles";

export function designForAi(d: Design) {
  const has = (...u: Parameters<typeof uses>[1][]) => u.some((x) => uses(d, x));
  const out: Record<string, unknown> = {
    inWords: describeDesign(d),
    label: d.name,
    ...(d.mood ? { mood: d.mood } : {}),
    type: d.type, style: d.style, metal: d.metal, purity: d.purity, options: d.options,
  };
  if (has("center") && !d.center.none) out.center = d.center;
  if (has("setting")) out.setting = d.setting;
  if (has("accents", "halo", "pave", "accentTop", "accentShapes") && d.accents.enabled) out.accents = d.accents;
  if (has("fringe") && d.fringe.enabled) out.fringe = d.fringe;
  if (has("enamel") && d.enamel.enabled) out.enamel = d.enamel;
  if (has("sides")) out.sides = d.sides;
  if (d.type === "ring") {
    out.band = d.band;
    out.ringSize = d.ringSize;
    if (d.gallery.roseCut) out.gallery = d.gallery;
  }
  if (has("extraStones")) out.extraStones = d.extraStones;
  if (has("drop")) out.drop = d.drop;
  if (has("frames")) out.frames = d.frames;
  if (has("motif")) out.motif = { ...d.motif, path: `[${d.motif.path.length} characters of SVG path]` };
  if (d.type === "earrings") { out.rightEar = d.rightEar; out.mirrorPair = d.mirrorPair; }
  return out;
}
