import * as THREE from "three";
import { type CenterStone, type Design, GEM_LOOK, SHAPE_RATIO, roundDiameter } from "../design";
import { Y } from "./common";
import { type Mats } from "./materials";
import { setStone } from "./stones";
import { wrap, yawAt } from "./curves";

const barSide = (count: number) => Math.max(1, Math.min(20, Math.round(count / 2)));

function edited(c: CenterStone, d: Design, key: string): { stone: CenterStone; scale: number } {
  const ed = d.stoneEdits.find((e) => e.key === key);
  if (!ed) return { stone: c, scale: 1 };
  const stone = { ...c, ...(ed.gem ? { gem: ed.gem, ...GEM_LOOK[ed.gem] } : {}), ...(ed.color ? { color: ed.color } : {}), ...(ed.cut ? { cut: ed.cut } : {}), ...(ed.shape ? { shape: ed.shape, lengthMm: c.widthMm * SHAPE_RATIO[ed.shape] } : {}) };
  return { stone, scale: ed.scale ?? 1 };
}

// A bar set into a chain: the centre stone in the middle and graduated stones out to each side, every setting joined to the next by a small ring.
export function graduatedBar(d: Design, m: Mats, curve: THREE.Curve<THREE.Vector3>, front: number) {
  const c = d.center, a = d.accents, total = curve.getLength();
  const n = barSide(d.options.count);
  const first = roundDiameter(a.gem, a.sizeCt);
  const look = GEM_LOOK[a.gem];
  const side = (i: number): CenterStone => {
    const shape = a.shapes[i % a.shapes.length] ?? "round";
    const k = a.sizes.length > i ? a.sizes[i] : 1 - (0.3 * i) / Math.max(1, n - 1);
    const W = Math.max(0.8, first * k);
    return { ...c, gem: a.gem, color: a.color, clarity: look.clarity, glow: a.glow ?? 0, cut: a.cut, shape, widthMm: W, lengthMm: W * SHAPE_RATIO[shape], domeMm: Math.max(0.3, W * 0.15), carat: null, rotation: a.orientation === "across" ? 90 : 0, label: "" };
  };
  const style = d.setting.style === "bezel" ? "bezel" : "four-claw";
  const group = new THREE.Group();
  const rim = (W: number) => (style === "bezel" ? Math.max(0.3, W * 0.08) : 0.15);
  const ringW = Math.max(0.25, first * 0.07);
  const ringAt = (s: number, gap: number) => {
    const u = wrap(front + s / total), t = curve.getTangentAt(u);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(Math.max(0.45, gap / 2 + ringW), ringW, 10, 24), m.metal);
    ring.position.copy(curve.getPointAt(u));
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3().crossVectors(t, Y).normalize());
    group.add(ring);
  };
  const put = (st: CenterStone, scale: number, s: number, key: string) => {
    const u = wrap(front + s / total);
    const g = setStone(st, style, m, scale);
    g.position.copy(curve.getPointAt(u));
    g.rotateY(yawAt(curve, u));
    g.userData.stoneKey = key;
    group.add(g);
  };

  const mid = edited(c, d, "bar0");
  const halfC = (mid.stone.widthMm * mid.scale) / 2 + rim(mid.stone.widthMm * mid.scale);
  put(mid.stone, mid.scale, 0, "bar0");
  const gap = Math.max(0.5, ringW * 2.5);
  for (const dir of [-1, 1]) {
    let edge = halfC;
    for (let i = 0; i < n; i++) {
      const key = `bar${dir < 0 ? "L" : "R"}${i}`;
      const e = edited(side(i), d, key);
      const half = (e.stone.widthMm * e.scale) / 2 + rim(e.stone.widthMm * e.scale);
      ringAt(dir * (edge + gap / 2), gap);
      put(e.stone, e.scale, dir * (edge + gap + half), key);
      edge += gap + half * 2;
    }
    if (dir > 0) group.userData.halfMm = edge;
  }
  const halfMm = group.userData.halfMm as number;
  ringAt(halfMm + gap / 2, gap);
  ringAt(-halfMm - gap / 2, gap);
  return { group, halfMm: halfMm + gap, maxW: Math.max(c.widthMm, first) };
}
