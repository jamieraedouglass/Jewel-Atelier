import * as THREE from "three";
import { type Design, roundDiameter } from "../design";
import { outlineFn } from "../ringModel";
import { type Piece, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone, tube } from "./stones";
import { accents, aroundOutline, backingPlate } from "./elements";
import { decoFrames } from "./ringHeads";

/** Men's pieces, laid flat: a set of sherwani buttons, or a pair of cufflinks. */
export function mensPiece(d: Design, m: Mats): Piece {
  return d.style === "cufflinks" ? cufflinks(d, m) : sherwaniButtons(d, m);
}

/**
 * A set of sherwani buttons in a row: each a gold button with the centre stone, framed by the Deco layers
 * (a ring of calibré emeralds by default), on a domed gold back with a shank.
 */
function sherwaniButtons(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const c = d.center;
  const n = Math.max(1, Math.min(13, d.options.count));
  const one = new THREE.Group();
  one.add(setStone(c, d.setting.style, m));
  const frames = decoFrames(d, m, c);
  one.add(frames.group);
  const R = Math.max(frames.extent, Math.max(c.lengthMm, c.widthMm) / 2) + 0.8;
  one.add(backingPlate(m, outlineFn("round", 1, 1), R * 2, -0.6, 1.4));
  // the shank underneath, for sewing on
  const shank = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.35, 8, 20), m.metal);
  shank.position.y = -2.6; one.add(shank);
  const step = R * 2 + 6;
  for (let i = 0; i < n; i++) {
    const b = i ? one.clone() : one;
    b.position.x = (i - (n - 1) / 2) * step;
    group.add(b);
  }
  return { group, focus: v3(0, 0, 0), focusSize: Math.max(R * 5, Math.min(n, 3) * step), upright: false };
}

/**
 * A pair of cufflinks: four stones in a square (sugarloaf emerald cabochons by default) with a little stone where
 * they meet, inside a border of small diamonds, on a gold face with a swivel bar behind.
 */
function cufflinks(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const c = d.center;
  const one = new THREE.Group();
  const S = Math.max(c.lengthMm, c.widthMm) + 0.5; // pitch between the four stones
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const s = setStone({ ...c, rotation: 0 }, "bezel", m);
    s.position.set((x * S) / 2, 0, (z * S) / 2);
    one.add(s);
  }
  const dia = Math.max(1.3, roundDiameter(d.accents.gem, d.accents.sizeCt));
  one.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: v3(0, 0.25, 0), dia: dia * 1.4 }], "princess"));
  const square = outlineFn("princess", S * 2, S * 2);
  one.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, aroundOutline(square, 0.3, dia, 0.15, 0)));
  const face = S + 0.6 + dia + 0.6;
  one.add(backingPlate(m, outlineFn("princess", 1, 1), face * 2, -0.7, 1.2));
  // the swivel bar behind the face
  one.add(tube(m, [v3(0, -1.9, 0), v3(0, -5.5, 0)], 0.7));
  const bar = new THREE.Mesh(new THREE.CapsuleGeometry(0.9, face * 1.1, 6, 12), m.metal);
  bar.rotation.z = Math.PI / 2; bar.position.y = -6.2; one.add(bar);
  const gap = face * 2 + 10;
  const right = one.clone();
  one.position.x = -gap / 2; right.position.x = gap / 2;
  group.add(one, right);
  return { group, focus: v3(-gap / 2, 0, 0), focusSize: face * 4, upright: false };
}
