import * as THREE from "three";
import { type Design, ringInnerDiameter, roundDiameter } from "../design";
import { motifPlate, motifShapes } from "../motifModel";
import { shankGeo } from "../ringModel";
import { type Piece, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone, tube } from "./stones";
import { type Item, accents, chainAlong, fringe, jumpRing } from "./elements";
import { loopCurve, outwardAt, place, spreadParams, wrap } from "./curves";

/** a custom motif: gold plate with its stones, top face at y = 0, the drawing's bottom toward +Z */
function motif(d: Design, m: Mats, scale = 1) {
  const mo = { ...d.motif, widthMm: d.motif.widthMm * scale };
  const g = motifPlate(mo, m.metal, d.enamel.enabled ? m.enamel : null);
  const ms = motifShapes(mo);
  const k = ms?.scale ?? mo.widthMm / 100;
  const at = (x: number, y: number) => (ms ? ms.toLocal(x, y) : v3((x - 50) * k, 0, (y - 50) * k));
  const acc: Item[] = [];
  for (const st of mo.stones) {
    const pos = at(st.x, st.y), dia = st.r * 2 * k;
    if (st.kind === "center") {
      const c = d.center, longest = Math.max(c.lengthMm, c.widthMm);
      const s = setStone(c, d.setting.style, m, dia / longest);
      s.position.copy(pos).add(v3(0, 0.15, 0));
      g.add(s);
    } else acc.push({ pos: pos.add(v3(0, 0.1, 0)), dia });
  }
  g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, acc));
  const box = new THREE.Box3().setFromObject(g);
  return { group: g, top: box.min.z, bottom: box.max.z, width: box.max.x - box.min.x };
}

export function motifPiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  if (d.type === "ring") {
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    group.add(new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish), m.metal));
    const mo = motif(d, m);
    mo.group.position.y = RIN + 2.3 + d.motif.thicknessMm + 0.3;
    group.add(mo.group);
    // posts joining the plate to the shank
    for (const sx of [-1, 1]) group.add(tube(m, [v3(sx * 1.6, RIN + 2.1, 0), v3(sx * 2.4, RIN + 2.3 + 0.3, 0)], 0.7));
    return { group, focus: v3(0, mo.group.position.y, 0), focusSize: Math.max(18, mo.width * 1.6), upright: true };
  }
  if (d.type === "earrings") {
    const one = new THREE.Group();
    const dia = Math.max(3, roundDiameter(d.accents.gem, d.accents.sizeCt) * 1.4);
    one.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: v3(), dia }]));
    one.add(jumpRing(m, 0.9, 0.24, v3(0, -0.2, dia / 2 + 0.7)));
    const mo = motif(d, m);
    mo.group.position.z = dia / 2 + 1.6 - mo.top;
    one.add(mo.group);
    const bottom = mo.group.position.z + mo.bottom;
    one.add(fringe(d, m, Array.from({ length: 5 }, (_, i) => ({ pos: v3((i / 4 - 0.5) * mo.width * 0.5, 0, bottom), dir: v3(0, 0, 1) })), 2));
    const gap = mo.width + 10;
    const right = one.clone();
    one.position.x = -gap / 2; right.position.x = gap / 2;
    group.add(one, right);
    return { group, focus: v3(-gap / 2, 0, mo.group.position.z), focusSize: mo.width * 2.2, upright: false };
  }
  const isNecklace = d.type === "necklace";
  const { curve, front } = loopCurve(isNecklace ? d.options.lengthIn * 25.4 : d.options.wristCm * 10 + 15, isNecklace ? 0.85 : 1.12, isNecklace && d.style === "motif-pendant" ? 0.22 : 0.05);
  const fp = curve.getPointAt(front);
  group.add(chainAlong(curve, d.options.chain, m));
  if (d.style === "motif-pendant") {
    const mo = motif(d, m);
    group.add(jumpRing(m, 1.2, 0.35, fp.clone().add(v3(0, 0, 1.2))));
    mo.group.position.copy(fp).add(v3(0, 0, 2.6 - mo.top));
    group.add(mo.group);
    const bottom = mo.group.position.z + mo.bottom;
    group.add(fringe(d, m, Array.from({ length: 7 }, (_, i) => ({ pos: v3((i / 6 - 0.5) * mo.width * 0.6, 0, bottom), dir: v3(0, 0, 1) })), 2));
    return { group, focus: mo.group.position.clone(), focusSize: mo.width * 2.4, upright: false };
  }
  const n = Math.max(1, d.options.count);
  const params = isNecklace ? spreadParams(front, n, 0.55) : Array.from({ length: n }, (_, i) => wrap(front + i / n));
  let size = 20;
  for (const u of params) {
    const mo = motif(d, m, isNecklace ? 0.6 : 0.5);
    const out = outwardAt(curve, u);
    // turn the motif so its top meets the chain and it hangs outward
    place(mo.group, curve.getPointAt(u).addScaledVector(out, -mo.top * 0.9), Math.atan2(out.x, out.z));
    group.add(mo.group);
    size = mo.width;
  }
  return { group, focus: fp, focusSize: size * 4, upright: false };
}
