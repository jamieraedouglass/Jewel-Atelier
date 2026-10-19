import * as THREE from "three";
import { NO_CHARACTER, type Design, roundDiameter } from "../design";
import { outlineFn } from "../ringModel";
import { type Piece, Y, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone, tube } from "./stones";
import { type Item, accents, aroundOutline, balls, chainAlong, fringe, ghungroo } from "./elements";
import { flower, halo, patternAt, patternRun } from "./patterns";
import { loopCurve, outwardAt, wrap } from "./curves";
import { braceletPiece } from "./bracelet";

export function ankletPiece(d: Design, m: Mats): Piece {
  if (d.style === "station-anklet") return braceletPiece({ ...d, style: "station" }, m, 245);
  const group = new THREE.Group();
  const { curve, front } = loopCurve(250, 1.12, 0);
  group.add(chainAlong(curve, d.options.chain, m));
  const n = Math.max(4, d.options.count);
  const bells: Item[] = [], loops: Item[] = [], dots: Item[] = [];
  for (let i = 0; i < n; i++) {
    const u = wrap(front + (i - (n - 1) / 2) * (0.75 / n));
    const out = outwardAt(curve, u), p = curve.getPointAt(u);
    loops.push({ pos: p.clone().addScaledVector(out, 1.2), dia: 1 });
    bells.push({ pos: p.clone().addScaledVector(out, 3.6), dia: 4.2, up: out.clone().negate() });
    if (i % 3 === 1) dots.push({ pos: p.clone().add(v3(0, 0.8, 0)), dia: 2.2 });
  }
  group.add(ghungroo(m.metal, bells), balls(m.metal, loops));
  if (d.enamel.enabled) group.add(balls(m.enamel, dots, 0.6));
  else group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, dots.map((x) => ({ ...x, dia: roundDiameter(d.accents.gem, d.accents.sizeCt) }))));
  return { group, focus: curve.getPointAt(front), focusSize: 40, upright: false };
}

export function headpiecePiece(d: Design, m: Mats): Piece {
  if (d.style === "tiara") return tiaraPiece(d, m);
  const group = new THREE.Group();
  const c = d.center;
  const f = flower(d, m, c);
  group.add(f.group);
  const top = v3(0, 0, -f.radius - 70);
  group.add(chainAlong(new THREE.LineCurve3(v3(0, 0, -f.radius - 0.5), top), "fine", m));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(3, 0.5, 10, 32, Math.PI * 1.5), m.metal);
  hook.rotation.x = Math.PI / 2; hook.position.copy(top).add(v3(0, 0, -3));
  group.add(hook);
  group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: v3(0, 0.3, -f.radius - 4), dia: Math.max(2.5, roundDiameter(d.accents.gem, d.accents.sizeCt)) }]));
  group.add(fringe(d, m, Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.15 + 0.7 * (i / 6)); return { pos: v3(Math.cos(a) * f.radius, 0, Math.sin(a) * f.radius), dir: v3(Math.cos(a), 0, Math.sin(a)) }; }), 2));
  if (d.style === "matha-patti") {
    for (const s of [-1, 1]) {
      for (let row = 0; row < 2; row++) {
        const pts = Array.from({ length: 24 }, (_, i) => { const t = i / 23; return v3(s * (t * 95 + 2), 0, top.z + 6 + row * 9 + Math.sin(t * Math.PI) * (26 + row * 8) - t * 8); });
        const cv = new THREE.CatmullRomCurve3(pts);
        group.add(chainAlong(cv, "fine", m));
        const n = Math.max(2, d.options.count);
        const items: Item[] = Array.from({ length: n }, (_, i) => ({ pos: cv.getPointAt((i + 0.5) / n).add(v3(0, 0.3, 0)), dia: Math.max(2.4, roundDiameter(d.accents.gem, d.accents.sizeCt) * 1.4) }));
        group.add(patternAt(d, m, items.map((it, i) => ({ ...it, tan: cv.getTangentAt((i + 0.5) / n) }))));
        if (row === 1) group.add(fringe(d, m, items.map((it) => ({ pos: it.pos.clone().add(v3(0, 0, it.dia / 2)), dir: v3(0, 0, 1) }))));
      }
    }
  }
  return { group, focus: v3(), focusSize: f.radius * 4, upright: false };
}

export function nosePiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  if (d.style === "nose-stud") {
    group.add(setStone(d.center, d.setting.style, m));
    if (d.options.halo) group.add(halo(d, m, d.center).group);
    return { group, focus: v3(), focusSize: Math.max(8, d.center.lengthMm * 3), upright: false };
  }
  const R = d.options.hoopDiameterMm / 2;
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(R, 0.55, 12, 160), m.metal);
  hoop.rotation.x = Math.PI / 2;
  group.add(hoop);
  const beads: Item[] = [], stones: Item[] = [];
  const pd = d.fringe.sizeMm, sd = Math.max(1.6, roundDiameter(d.accents.gem, d.accents.sizeCt));
  for (let a = Math.PI * 0.22, i = 0; a < Math.PI * 0.78; i++) {
    const isPearl = i % 2 === 0, dia = isPearl ? pd : sd;
    beads.length; (isPearl ? beads : stones).push({ pos: v3(Math.cos(a) * R, 0, Math.sin(a) * R), dia, up: Y });
    a += (dia + 0.3) / R;
  }
  group.add(balls(m.bead(d.fringe.gem, d.fringe.color), beads));
  group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, stones.map((s) => ({ ...s, pos: s.pos.clone().add(v3(0, 0.6, 0)) }))));
  group.add(fringe({ ...d, fringe: { ...d.fringe, enabled: true } }, m, [{ pos: v3(0, 0, R + pd / 2), dir: v3(0, 0, 1) }], 2));
  const chain = new THREE.CatmullRomCurve3([v3(R * 0.7, 0, -R * 0.7), v3(R * 2, 0, -R * 1.4), v3(R * 3.4, 0, -R * 0.6), v3(R * 4.2, 0, -R * 1.8)]);
  group.add(chainAlong(chain, "fine", m));
  return { group, focus: v3(0, 0, R * 0.6), focusSize: R * 3, upright: false };
}

export function armletPiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const { curve, front } = loopCurve(280, 1.0, 0);
  const arc = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => curve.getPointAt(wrap(front - 0.12 + (i / 39) * 0.24))));
  const band = new THREE.Mesh(new THREE.TubeGeometry(arc, 120, 1.6, 16, false), m.metal);
  band.scale.y = 3.5;
  group.add(band);
  group.add(chainAlong(curve, "rope", m, front + 0.12, front + 0.88));
  const f = flower(d, m, d.center);
  const out = outwardAt(curve, front);
  f.group.position.copy(curve.getPointAt(front)).addScaledVector(out, 2);
  f.group.quaternion.setFromUnitVectors(Y, out);
  group.add(f.group);
  const accentDia = Math.max(2, roundDiameter(d.accents.gem, d.accents.sizeCt));
  for (const s of [-1, 1]) {
    const params = Array.from({ length: 6 }, (_, i) => wrap(front + s * (0.03 + i * 0.015)));
    group.add(patternAt(d, m, params.map((u) => ({ pos: curve.getPointAt(u).addScaledVector(outwardAt(curve, u), 1.8), dia: accentDia * (1 - Math.abs(u - front) * 4), up: outwardAt(curve, u), tan: curve.getTangentAt(u) }))));
  }
  group.add(fringe(d, m, Array.from({ length: 9 }, (_, i) => { const u = wrap(front + (i / 8 - 0.5) * 0.12); return { pos: curve.getPointAt(u).addScaledVector(outwardAt(curve, u), 2).add(v3(0, -5.2, 0)), dir: v3(0, -1, 0).add(outwardAt(curve, u)).normalize() }; })));
  return { group, focus: f.group.position.clone(), focusSize: f.radius * 5, upright: false };
}

export function handPiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const { curve, front } = loopCurve(175, 1.12, 0);
  const wristOffset = v3(0, 0, -70);
  const wrist = chainAlong(curve, d.options.chain, m);
  wrist.position.copy(wristOffset);
  group.add(wrist);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 12, 80), m.metal);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, 0, 70);
  group.add(ring);
  const f = flower(d, m, d.center);
  group.add(f.group);
  const ringFlower = flower(d, m, { ...d.center, ...NO_CHARACTER, lengthMm: 4, widthMm: 4, domeMm: 0.6 }, 1);
  ringFlower.group.position.set(0, 0.9, 70 - 9);
  group.add(ringFlower.group);
  group.add(chainAlong(new THREE.LineCurve3(v3(0, 0, f.radius), v3(0, 0, 70 - 9 - ringFlower.radius)), "fine", m));
  const wf = curve.getPointAt(front).add(wristOffset);
  for (const x of [-22, 0, 22]) {
    const end = v3(x, 0, wf.z - 1.5 + Math.abs(x) * 0.12);
    group.add(chainAlong(new THREE.CatmullRomCurve3([v3(x * 0.2, 0, -f.radius), v3(x * 0.6, 0, (wf.z - f.radius) / 2), end]), "fine", m));
  }
  return { group, focus: v3(), focusSize: f.radius * 6, upright: false };
}

function tiaraPiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const c = d.center;
  const n = Math.max(3, Math.min(13, d.options.count | 1));
  const R = 75, half = 1.05;
  const at = (t: number) => v3(Math.sin(t * half) * R, 0, (1 - Math.cos(t * half)) * R * 0.35);
  const band = new THREE.CatmullRomCurve3(Array.from({ length: 41 }, (_, i) => at(i / 20 - 1)));
  group.add(new THREE.Mesh(new THREE.TubeGeometry(band, 160, 1.1, 10), m.metal));
  group.add(patternRun(d, m, band, 0, 1, { gap: 0.15, offset: () => v3(0, 1.05, 0) }).group);
  const leaf = Math.max(1.3, roundDiameter(d.accents.gem, d.accents.sizeCt) * 1.05);
  const span = 1.7;
  const spires = Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * span - span / 2;
    const k = 1 - Math.abs(t) / (span / 2);
    const base = at(t);
    const tan = band.getTangentAt((t + 1) / 2);
    const up = v3(tan.z, 0, -tan.x).normalize();
    if (up.z > 0) up.negate();
    return { base, up, k, height: 10 + k * 18 };
  });
  const turnUp = (o: THREE.Object3D, up: THREE.Vector3, flip = false) => { o.rotation.y = Math.atan2(up.x, up.z) + (flip ? Math.PI : 0); };
  const leaves: Item[] = [];
  const lineAlong = (cv: THREE.Curve<THREE.Vector3>) => {
    const L = cv.getLength(), count = Math.max(2, Math.floor(L / (leaf * 1.75)));
    for (let j = 0; j <= count; j++) {
      const u = j / count, p = cv.getPointAt(u), tg = cv.getTangentAt(u);
      leaves.push({ pos: p.clone().add(v3(0, 0.3, 0)), dia: leaf, yaw: Math.atan2(tg.x, tg.z) });
    }
  };
  for (let i = 0; i < n - 1; i++) {
    const a = spires[i], b = spires[i + 1];
    const up = a.up.clone().add(b.up).normalize();
    const mid = a.base.clone().add(b.base).multiplyScalar(0.5);
    const apexH = Math.min(a.height, b.height) * 0.8;
    const apex = mid.clone().addScaledVector(up, apexH);
    const arch = new THREE.CatmullRomCurve3([
      a.base.clone().addScaledVector(a.up, a.height * 0.25), mid.clone().lerp(a.base, 0.55).addScaledVector(up, apexH * 0.85), apex,
      mid.clone().lerp(b.base, 0.55).addScaledVector(up, apexH * 0.85), b.base.clone().addScaledVector(b.up, b.height * 0.25),
    ], false, "centripetal");
    group.add(new THREE.Mesh(new THREE.TubeGeometry(arch, 48, 0.35, 6), m.metal));
    lineAlong(arch);
    const k = (a.k + b.k) / 2, scale = 0.32 + 0.12 * k;
    const drop = setStone({ ...c, rotation: 0 }, d.setting.style, m, scale);
    drop.position.copy(apex).addScaledVector(up, -(c.lengthMm * scale) / 2 - 1.2);
    turnUp(drop, up);
    group.add(drop);
  }
  for (const sp of spires) {
    const tip = sp.base.clone().addScaledVector(sp.up, sp.height);
    const stem = new THREE.LineCurve3(sp.base.clone(), tip);
    group.add(tube(m, [sp.base, tip], 0.4));
    lineAlong(stem);
    const centre = sp.k > 0.99;
    const scale = centre ? 1 : 0.42 + 0.3 * sp.k;
    const top = new THREE.Group();
    top.add(setStone({ ...c, rotation: 0 }, d.setting.style, m, scale));
    if (centre) {
      const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
      top.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, aroundOutline(fn, 0.3, leaf * 0.85, 0.12, -0.2)));
    }
    top.position.copy(tip).addScaledVector(sp.up, (c.lengthMm * scale) / 2 + (centre ? leaf + 0.6 : 0.5));
    turnUp(top, sp.up);
    group.add(top);
  }
  group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, leaves, "marquise"));
  return { group, focus: v3(0, 0, -18), focusSize: 170, upright: false };
}
