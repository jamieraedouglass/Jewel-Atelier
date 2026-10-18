import * as THREE from "three";
import { NO_CHARACTER, type CenterStone, type Design, rightEarDesign, roundDiameter } from "../design";
import { type Piece, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone, setStoneRaw, tube } from "./stones";
import { ASPECT, type Item, accents, balls, fringe, jumpRing } from "./elements";
import { type RunOpts, bell, flower, halo, patternAt, patternMaxW, patternRun } from "./patterns";
import { decoFrames, flowerCluster } from "./ringHeads";
import { dropStack, hook } from "./drops";

function stud(d: Design, m: Mats, mirror: boolean) {
  const g = new THREE.Group();
  const flip = mirror ? -1 : 1;
  const c = d.center;
  const main = new THREE.Group();
  main.add(setStoneRaw(c, d.setting.style, m));
  if (d.options.halo) main.add(halo(d, m, c).group);
  main.rotation.y = THREE.MathUtils.degToRad(c.rotation * flip);
  g.add(main);
  const reach = (L: number, W: number, deg: number) => { const r = THREE.MathUtils.degToRad(deg); return (Math.abs(Math.cos(r)) * L + Math.abs(Math.sin(r)) * W) / 2; };
  let z = reach(c.lengthMm, c.widthMm, c.rotation) + (d.options.halo ? roundDiameter(d.accents.gem, d.accents.sizeCt) + 0.8 : 0);
  let prev = new THREE.Vector3();
  for (const e of d.extraStones) {
    const stone: CenterStone = { ...c, ...NO_CHARACTER, ...e, domeMm: e.cut === "faceted" ? Math.max(e.domeMm, Math.min(e.widthMm, e.lengthMm) * 0.15) : e.domeMm, carat: null, label: "", photoPath: null, rotation: 0 };
    const half = reach(e.lengthMm, e.widthMm, e.rotation);
    const pos = new THREE.Vector3(e.dx * flip, 0, z + 0.4 + half + e.dz);
    const s = setStoneRaw(stone, d.setting.style, m);
    s.rotation.y = THREE.MathUtils.degToRad(e.rotation * flip);
    s.position.copy(pos);
    s.userData.part = "extra";
    g.add(s);
    g.add(tube(m, [prev.clone().setY(-1.1), pos.clone().setY(-1.1)], 0.45));
    prev = pos;
    z = pos.z + half;
  }
  return g;
}

function hoopEarring(d: Design, m: Mats, huggie: boolean) {
  const g = new THREE.Group();
  const R = (huggie ? Math.min(d.options.hoopDiameterMm, 16) : d.options.hoopDiameterMm) / 2;
  const stoneW = d.options.pave ? patternMaxW(d, huggie ? 3.6 : 2.8) : 0;
  const sideSet = d.options.pave && d.options.hoopFace !== "front";
  const T = sideSet ? (huggie ? 2.4 : 1.4) : Math.max(huggie ? 2.6 : 1.5, stoneW + (huggie ? 0.8 : 0.6));
  const D = sideSet ? Math.max(huggie ? 3 : 1.8, stoneW + 0.6) : huggie ? Math.max(3, T * 1.1) : Math.max(1.6, T * 0.9);
  const gapA = Math.max(0.12, 1.4 / R);
  const hs = d.options.hoopShape;
  const rx = hs === "round" ? R : hs === "oval" ? R * 0.72 : R * 0.5, ry = hs === "round" ? R : hs === "oval" ? R * 1.25 : R * 1.45;
  const ex = hs === "paperclip" ? 0.45 : 1;
  const arc = new THREE.CatmullRomCurve3(Array.from({ length: 160 }, (_, i) => {
    const a = Math.PI / 2 + gapA + (i / 159) * (2 * Math.PI - 2 * gapA);
    const c = Math.cos(a), sn = Math.sin(a);
    return v3(Math.sign(c) * Math.pow(Math.abs(c), ex) * rx, Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ry - (ry - R), 0);
  }));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(arc, 240, T / 2, 20, false), m.metal);
  wire.scale.z = D / T;
  g.add(wire);
  const endA = arc.getPointAt(0), endB = arc.getPointAt(1);
  for (const e of [endA, endB]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(T / 2, 16, 12), m.metal); cap.scale.z = D / T; cap.position.copy(e); g.add(cap); }
  g.add(tube(m, [endB.clone(), endB.clone().lerp(endA, 0.5).add(v3(0, 0.25, 0)), endA.clone()], Math.min(0.42, T * 0.2)));
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(T * 0.42, T * 0.42, D * 0.9, 16), m.metal);
  knuckle.rotation.x = Math.PI / 2; knuckle.position.copy(endB);
  g.add(knuckle);
  if (d.options.pave) {
    const span = { front: [0.14, 0.86], half: [0.25, 0.75], full: [0.03, 0.97] }[d.options.paveCoverage];
    const face = d.options.hoopFace;
    const radial = (u: number) => { const t = arc.getTangentAt(u); return v3(t.y, -t.x, 0).normalize(); };
    const opts: RunOpts = face === "front"
      ? { up: () => v3(0, 0, 1), offset: () => v3(0, 0, D / 2 - 0.05), maxW: T - 0.4, gap: 0.12 }
      : face === "outer"
      ? { up: radial, offset: (u) => radial(u).multiplyScalar(T / 2 - 0.05), maxW: D - 0.4, gap: 0.12 }
      : { up: (u) => radial(u).negate(), offset: (u) => radial(u).multiplyScalar(-(T / 2 - 0.05)), maxW: D - 0.4, gap: 0.12 };
    g.add(patternRun(d, m, arc, span[0], span[1], { ...opts, editKey: "hoop" }).group);
  }
  if (!huggie && d.fringe.enabled) {
    const beads: Item[] = [];
    const D0 = d.fringe.sizeMm;
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const u0 = 0.3, u1 = 0.7;
    for (let u = u0; u <= u1; u += D0 * 0.5 / arc.getLength()) {
      const k = Math.sin(((u - u0) / (u1 - u0)) * Math.PI);
      const rows = 1 + Math.round(k * 3);
      const p0 = arc.getPointAt(u), nrm = (() => { const t = arc.getTangentAt(u); return v3(t.y, -t.x, 0).normalize(); })();
      for (let r = 0; r < rows; r++) {
        const dia = D0 * (0.65 + rnd() * 0.5) * (0.75 + 0.25 * k);
        const out = (r - (rows - 1) / 2) * D0 * 0.62 + (rnd() - 0.5) * D0 * 0.2;
        beads.push({ pos: p0.clone().addScaledVector(nrm, out).add(v3(0, 0, D / 2 + dia * 0.25 + Math.abs(out) * -0.15)), dia });
      }
    }
    const cluster = balls(m.bead(d.fringe.gem, d.fringe.color), beads, d.fringe.gem === "pearl" ? 1 : 0.95);
    const cg = new THREE.Group(); cg.userData.part = "fringe"; cg.add(cluster);
    g.add(cg);
  }
  const box = new THREE.Box3().setFromObject(g);
  let low = Math.min(-R - T / 2, box.min.y);
  if (!huggie && !d.center.none) {
    const c = d.center;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.24, 10, 24), m.metal);
    ring.position.set(0, low - 0.6, 0);
    g.add(ring);
    const charm = setStone(c, d.setting.style, m);
    const holder = new THREE.Group();
    holder.add(charm);
    if (c.shape === "pear" || c.shape === "heart") charm.rotateY(Math.PI);
    holder.rotation.x = Math.PI / 2;
    const turn = new THREE.Group();
    turn.rotation.y = THREE.MathUtils.degToRad(d.options.charmTurn);
    turn.position.set(0, low - 1.8 - c.lengthMm / 2, 0);
    turn.add(holder);
    g.add(turn);
    low -= 1.8 + c.lengthMm;
  }
  return { group: g, R, T, low };
}

function hoopPair(d: Design, m: Mats, huggie: boolean, rd: Design | null = null): Piece {
  const left = hoopEarring(d, m, huggie), right = hoopEarring(rd ?? d, m, (rd ?? d).style === "huggie");
  left.group.userData.ear = "left"; right.group.userData.ear = "right";
  const sep = Math.max(left.R + left.T, right.R + right.T) + 6;
  left.group.position.x = -sep; left.group.rotation.y = 0.35;
  right.group.position.x = sep; right.group.rotation.y = -0.35;
  const group = new THREE.Group();
  group.add(left.group, right.group);
  return { group, focus: v3(-sep, (left.low + left.R) / 2, 0), focusSize: (left.R + left.T) * 2.6 + (left.R - left.low), upright: true };
}

export function earringPiece(d: Design, m: Mats): Piece {
  const rd = d.rightEar ? rightEarDesign(d) : null;
  if (d.style === "hoop" || d.style === "huggie") return hoopPair(d, m, d.style === "huggie", rd);
  const L = earringOne(d, m, false);
  const studMirror = d.style === "stud" && d.mirrorPair && !rd;
  const R = rd ? earringOne(rd, m, false) : studMirror ? earringOne(d, m, true) : { one: L.one.clone(), focus: L.focus, focusSize: L.focusSize };
  const wOf = (g: THREE.Object3D) => { const b = new THREE.Box3().setFromObject(g); return { w: b.max.x - b.min.x, c: (b.max.x + b.min.x) / 2 }; };
  const a = wOf(L.one), b = wOf(R.one);
  const sep = (a.w + b.w) / 2 + 10;
  L.one.position.x = -sep / 2 - a.c; R.one.position.x = sep / 2 - b.c;
  if (!rd && (d.style === "climber" || ((d.style === "chandelier" || d.style === "pendant") && d.mirrorPair))) { R.one.scale.x = -1; R.one.position.x = sep / 2 + b.c; }
  if (rd && rd.style === "climber") { R.one.scale.x = -1; R.one.position.x = sep / 2 + b.c; }
  L.one.userData.ear = "left"; R.one.userData.ear = "right";
  const group = new THREE.Group();
  group.add(L.one, R.one);
  const focus = L.focus.clone(); focus.x += L.one.position.x;
  return { group, focus, focusSize: Math.max(L.focusSize, rd ? R.focusSize : 0), upright: false };
}

function earringOne(d: Design, m: Mats, mirrorStud: boolean): { one: THREE.Group; focus: THREE.Vector3; focusSize: number } {
  const c = d.center, o = d.options, st = d.style;
  const one = new THREE.Group();
  let focus = v3(), focusSize = Math.max(c.lengthMm, c.widthMm) * 1.6;
  const accentDia = roundDiameter(d.accents.gem, d.accents.sizeCt);
  const topStud = (z = 0) => {
    const f = flower(d, m, { ...c, ...NO_CHARACTER, lengthMm: Math.min(c.lengthMm, 6), widthMm: Math.min(c.widthMm, 6) });
    f.group.position.z = z;
    one.add(f.group);
    return f.radius;
  };

  if (st === "deco") {
    one.add(setStone(c, d.setting.style, m));
    const f = decoFrames(d, m, c);
    one.add(f.group);
    focusSize = f.extent * 3;
  } else if (st === "flowers") {
    one.add(flowerCluster(d, m));
    focusSize = 18;
  } else if (st === "stud") {
    one.add(stud(d, m, mirrorStud));
    focusSize = Math.max(c.lengthMm, c.widthMm) * (1.6 + d.extraStones.length);
  } else if (st === "drop") {
    let top: number;
    if (o.accentTop) { one.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: v3(), dia: accentDia }])); top = accentDia / 2; }
    else { one.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), m.metal)); top = 1.4; }
    one.add(jumpRing(m, 0.9, 0.22, v3(0, -0.2, top + 0.6)));
    const drop = setStone(c, d.setting.style, m);
    if (c.shape === "pear") drop.rotation.y = Math.PI;
    const z = top + 1.5 + c.lengthMm / 2 + 0.4;
    drop.position.set(0, 0, z);
    one.add(drop);
    focus = v3(0, 0, z);
  } else if (st === "chandelier" || st === "pendant") {
    const stack = dropStack(d, m);
    one.add(stack.group);
    if (d.drop.top === "hook") one.add(hook(m, stack.top - 0.5));
    focus = v3(0, 0, stack.bottom * 0.5); focusSize = Math.max(18, stack.bottom * 1.25);
  } else if (st === "jhumka") {
    const r = topStud();
    const b = bell(d, m, Math.max(7, r * 1.15));
    const z0 = r + 2.2;
    b.group.position.z = z0;
    one.add(b.group, jumpRing(m, 1, 0.28, v3(0, 0, r + 0.9)));
    const n = Math.floor((Math.PI * 2 * b.R) / (d.fringe.sizeMm + 0.5));
    one.add(fringe(d, m, Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { pos: v3(Math.cos(a) * b.R, Math.sin(a) * b.R * 0.35, z0 + b.rimZ), dir: v3(0, 0, 1) };
    })));
    focus = v3(0, 0, z0); focusSize = (z0 + b.rimZ) * 1.8;
  } else if (st === "chandbali") {
    const r = topStud();
    const R = Math.max(14, r * 2.3), zc = r + 2 + R * 0.25;
    const outerPts: THREE.Vector2[] = [], innerPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI;
      outerPts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R));
      innerPts.push(new THREE.Vector2(Math.cos(Math.PI - a) * R * 0.66, Math.sin(Math.PI - a) * R * 0.66 - R * 0.12));
    }
    const shape = new THREE.Shape([...outerPts, ...innerPts]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2, curveSegments: 6 });
    geo.rotateX(Math.PI / 2); geo.translate(0, -0.3, zc);
    one.add(new THREE.Mesh(geo, m.metal));
    if (d.enamel.enabled) { const e = new THREE.Mesh(geo.clone().translate(0, -0.6, 0).scale(1.02, 1, 1), m.enamel); one.add(e); }
    for (const k of [0.92, 0.76]) {
      const rr = R * k - (k < 0.8 ? R * 0.05 : 0);
      const arcC = new THREE.CatmullRomCurve3(Array.from({ length: 48 }, (_, i) => { const a = 0.12 + (i / 47) * (Math.PI - 0.24); return v3(Math.cos(a) * rr, 0.4, zc + Math.sin(a) * rr); }));
      one.add(patternRun(d, m, arcC, 0, 1, { maxW: R * 0.12, gap: 0.25 }).group);
    }
    const cs = setStone(c, d.setting.style, m, Math.min(1, (R * 0.5) / Math.max(c.lengthMm, c.widthMm)));
    if (c.shape === "pear") cs.rotation.y = Math.PI;
    cs.position.set(0, 0.2, zc + R * 0.18);
    one.add(cs, tube(m, [v3(0, 0.1, zc - R * 0.08), v3(0, 0.1, zc + R * 0.02)], 0.25));
    one.add(tube(m, [v3(-R, 0, zc), v3(-R * 0.5, 0, r + 1.2), v3(0, 0, r + 0.6), v3(R * 0.5, 0, r + 1.2), v3(R, 0, zc)], 0.3));
    const nf = Math.floor((Math.PI * R) / (d.fringe.sizeMm + 0.6));
    one.add(fringe(d, m, Array.from({ length: nf }, (_, i) => {
      const a = (i / Math.max(1, nf - 1)) * Math.PI;
      return { pos: v3(Math.cos(a) * (R + 0.3), 0, zc + Math.sin(a) * (R + 0.3)), dir: v3(Math.cos(a), 0, Math.sin(a)) };
    })));
    focus = v3(0, 0, zc + R * 0.4); focusSize = R * 2.8;
  } else if (st === "climber") {
    const n = Math.max(3, o.count);
    const curveC = new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => { const t = i / 23; return v3(Math.sin(t * 1.3) * 10, 0, -t * 22); }));
    const orient = d.accents.orientation;
    const spec = Array.from({ length: n }, (_, i) => {
      const shape = d.accents.shapes[i % d.accents.shapes.length];
      const along = orient === "along" || (orient === "alternate" && i % 2 === 0);
      const W = accentDia * (1.4 - 0.8 * (i / (n - 1)));
      const t = THREE.MathUtils.degToRad(d.accents.turns[i % d.accents.shapes.length] ?? 0);
      const a = along ? W * ASPECT[shape] : W, b = along ? W : W * ASPECT[shape];
      return { W, foot: Math.abs(Math.cos(t)) * a + Math.abs(Math.sin(t)) * b };
    });
    const len = curveC.getLength(), need = spec.reduce((a, x) => a + x.foot + 0.25, 0);
    const k = Math.min(1, len / need);
    let at = 0;
    const items = spec.map((x) => {
      const u = Math.min(1, (at + (x.foot * k) / 2) / len);
      at += x.foot * k + 0.25 * k;
      return { pos: curveC.getPointAt(u), dia: x.W * k, tan: curveC.getTangentAt(u) };
    });
    one.add(patternAt(d, m, items));
    one.add(tube(m, items.map((it) => it.pos.clone().setY(-0.5)), 0.35));
    focus = v3(4, 0, -11); focusSize = 30;
  } else {
    one.add(setStone(c, d.setting.style, m, Math.min(1, 6 / Math.max(c.lengthMm, c.widthMm))));
    const capZ = Math.min(c.lengthMm, 6) / 2 + 2.5;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4, 32, 1, true), m.metal);
    cap.rotation.x = -Math.PI / 2; cap.position.z = capZ + 2;
    one.add(cap);
    const strands = Math.max(3, o.count);
    for (let s = 0; s < strands; s++) {
      const x = (s / (strands - 1) - 0.5) * 4.2;
      const pts = Array.from({ length: 9 }, (_, i) => v3(x * (1 + i * 0.08), 0, capZ + 4 + i * (d.fringe.sizeMm * 0.8)));
      one.add(balls(d.fringe.enabled ? m.bead(d.fringe.gem, d.fringe.color) : m.metal, pts.map((p) => ({ pos: p, dia: Math.min(2.4, d.fringe.sizeMm * 0.55) }))));
    }
    focus = v3(0, 0, capZ + 12); focusSize = 50;
  }

  return { one, focus, focusSize };
}
