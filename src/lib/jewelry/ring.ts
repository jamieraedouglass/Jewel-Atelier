import * as THREE from "three";
import { NO_CHARACTER, type CenterStone, type Design, type Gem, ringInnerDiameter } from "../design";
import { bandSection, buildRing, outlineFn, shankGeo, splitArms } from "../ringModel";
import { type Piece, v3 } from "./common";
import { type Mats, makeMaterials } from "./materials";
import { setStoneRaw, tube } from "./stones";
import { ASPECT, accents, aroundOutline, backingPlate, balls } from "./elements";
import { halo, outlineCurve, patternMaxW, patternRun } from "./patterns";
import { decoFrames, flowerCluster, halfFlower, swirlArms } from "./ringHeads";
import { handPolished } from "../polish";

function edgeX(shape: CenterStone["shape"], L: number, W: number, deg: number, side: 1 | -1): number {
  const fn = outlineFn(shape, L, W), r = THREE.MathUtils.degToRad(deg), cos = Math.cos(r), sin = Math.sin(r);
  let most = 0;
  for (let i = 0; i < 180; i++) { const [x, z] = fn(i / 180); most = Math.max(most, side * (x * cos + z * sin)); }
  return most;
}

export function mosaicFrame(d: Design) {
  if (d.type !== "ring" || d.style !== "deco" || !d.options.decoWrap) return null;
  const stoneLayers = d.frames.filter((f) => f.kind === "fill" || f.kind === "stones");
  return stoneLayers[stoneLayers.length - 1] ?? null;
}

export function ringPiece(d0: Design): Piece {
  const mosaic = mosaicFrame(d0);
  const d: Design = mosaic ? { ...d0, band: { ...d0.band, widthMm: Math.max(d0.band.widthMm, 7), shape: "flat", pave: d0.band.pave === "none" ? "full" : d0.band.pave } } : d0;
  const m = makeMaterials(d);
  const st = d.style;
  if (st === "eternity") {
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const band = new THREE.Mesh(shankGeo(RIN, Math.max(d.band.widthMm, 2.6), "polished"), m.metal);
    group.add(band);
    const Ro = RIN + 1.75;
    const circle = new THREE.CatmullRomCurve3(Array.from({ length: 128 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return v3(Math.sin(a) * Ro, Math.cos(a) * Ro, 0); }), true);
    group.add(patternRun(d, m, circle, 0, 1, { closed: true, maxW: Math.max(d.band.widthMm, 2.6) * 0.9, up: (u) => circle.getPointAt(u).normalize(), offset: (u) => circle.getPointAt(u).normalize().multiplyScalar(0.05), gap: 0.25 }).group);
    return { group, focus: v3(0, Ro, 0), focusSize: 18, upright: true };
  }
  if (st === "wide-band") {
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const bw = Math.max(d.band.widthMm, 3);
    const innerMat = handPolished((m.metal as THREE.MeshPhysicalMaterial).clone()); innerMat.side = THREE.DoubleSide;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(RIN + 1.9, RIN + 1.9, bw, 160, 1, true), innerMat);
    band.rotation.x = Math.PI / 2;
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(RIN, RIN, bw, 160, 1, true), innerMat);
    inner.rotation.x = Math.PI / 2;
    group.add(band, inner);
    for (const z of [-bw / 2, bw / 2]) { const lip = new THREE.Mesh(new THREE.TorusGeometry(RIN + 0.95, 0.95, 12, 160), m.metal); lip.position.z = z; lip.scale.z = 0.5; group.add(lip); }
    const W = patternMaxW(d);
    const rows = Math.max(1, Math.min(6, d.options.layers));
    const edges = d.options.halo;
    const Ro = RIN + 1.95;
    const circle = new THREE.CatmullRomCurve3(Array.from({ length: 160 }, (_, i) => { const a = (i / 160) * Math.PI * 2; return v3(Math.sin(a) * Ro, Math.cos(a) * Ro, 0); }), true);
    const zs = edges
      ? Array.from({ length: rows }, (_, r) => { const half = Math.ceil(rows / 2); const k = r < half ? r : r - half; const s = r < half ? -1 : 1; return s * (bw / 2 - W / 2 - 0.35 - k * (W + 0.25)); })
      : Array.from({ length: rows }, (_, r) => (r - (rows - 1) / 2) * Math.min(W + 0.25, (bw - W) / Math.max(1, rows - 1)));
    for (const z of zs) {
      group.add(patternRun(d, m, circle, 0, 1, { closed: true, up: (u) => circle.getPointAt(u).normalize(), offset: (u) => circle.getPointAt(u).normalize().multiplyScalar(0.02).add(v3(0, 0, z)), gap: 0.2, maxW: W }).group);
      if (edges) { const rim = new THREE.Mesh(new THREE.TorusGeometry(Ro + 0.15, 0.18, 6, 200), m.metal); rim.position.z = z + Math.sign(z) * (W / 2 + 0.15); group.add(rim); }
    }
    return { group, focus: v3(0, Ro, 0), focusSize: Math.max(18, bw * 2.4), upright: true };
  }
  if (d.center.none) {
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const sh = new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish, undefined, d.band.shape, d.band.split), m.metal);
    sh.userData.shank = true;
    group.add(sh);
    bandPave(group, d, m);
    return { group, focus: v3(0, RIN, 0), focusSize: 24, upright: true };
  }
  const base = st === "three-stone" || st === "halo" ? d : { ...d, sides: { ...d.sides, kind: "none" as const } };
  const group = buildRing(base);
  if (st === "two-stone" && d.extraStones[0]) {
    const e = d.extraStones[0];
    const head: THREE.Group | undefined = group.userData.head;
    const reach = (L: number, W: number, deg: number) => { const r = THREE.MathUtils.degToRad(deg); return (Math.abs(Math.cos(r)) * W + Math.abs(Math.sin(r)) * L) / 2; };
    const touching = d.options.pairSpacing === "touching";
    const a = touching ? edgeX(d.center.shape, d.center.lengthMm, d.center.widthMm, d.center.rotation, 1) + 0.05 : reach(d.center.lengthMm, d.center.widthMm, d.center.rotation) + 0.4;
    const b = touching ? edgeX(e.shape, e.lengthMm, e.widthMm, e.rotation, -1) + 0.05 : reach(e.lengthMm, e.widthMm, e.rotation) + 0.4;
    if (head) head.position.x = -a;
    const gy0: number = group.userData.girdleY ?? 12;
    const mm = makeMaterials(d);
    const partner = setStoneRaw({ ...d.center, ...NO_CHARACTER, ...e, carat: null, label: "", photoPath: null, rotation: 0, none: false }, d.setting.style, mm);
    partner.rotation.y = THREE.MathUtils.degToRad(e.rotation);
    partner.position.set(b + e.dx, gy0, e.dz);
    partner.userData.part = "extra";
    group.add(partner);
    if (d.options.halo) {
      const hm = halo(d, mm, d.center); hm.group.position.set(-a, gy0, 0); hm.group.rotation.y = THREE.MathUtils.degToRad(d.center.rotation); group.add(hm.group);
      const pc = { ...d.center, ...NO_CHARACTER, ...e, carat: null, label: "", photoPath: null, rotation: 0, none: false };
      const hp = halo(d, mm, pc); hp.group.position.set(b + e.dx, gy0, e.dz); hp.group.rotation.y = THREE.MathUtils.degToRad(e.rotation); group.add(hp.group);
    }
    group.add(tube(mm, [v3(-a, gy0 - 1.6, 0), v3(0, gy0 - 2.4, 0), v3(b + e.dx, gy0 - 1.6, e.dz)], 0.6));
    applyProfile(group, d, gy0);
    bandPave(group, d, mm);
    const top = new THREE.Box3().setFromObject(group).max.y;
    return { group, focus: v3(0, top - d.center.domeMm - 1, 0), focusSize: 30, upright: true };
  }
  const gy: number = group.userData.girdleY ?? 12;
  const c = d.center;
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
  const at = (o: THREE.Object3D) => { o.position.y += gy; group.add(o); };
  if (st === "halo") at(halo(d, m, c).group);
  if (st === "posy") { const f = flowerCluster(d, m, c); f.rotation.y = THREE.MathUtils.degToRad(c.rotation); at(f); }
  let decoTop: THREE.Object3D | null = null;
  if (st === "deco") { decoTop = decoFrames(d, m, c).group; at(decoTop); }
  if (st === "half-flower") {
    const f = new THREE.Group();
    f.add(halfFlower(d, m, c, d.options.halo, d.options.flowerPlace === "band"));
    f.rotation.y = THREE.MathUtils.degToRad(c.rotation);
    at(f);
  }
  if (st === "swirl") group.add(swirlArms(d, m, c, gy, ringInnerDiameter(d.ringSize) / 2));
  if (st === "polki-cocktail") {
    const h = halo(d, m, c, 2);
    at(h.group);
    if (d.fringe.enabled) {
      const dia = d.fringe.sizeMm * 0.8;
      at(balls(m.bead(d.fringe.gem, d.fringe.color), aroundOutline(fn, h.extent + 0.2, dia, 0.15, -0.3)));
    }
  }
  if (st === "cluster") {
    const dia = patternMaxW(d);
    at(patternRun(d, m, outlineCurve(c, 0.35 + dia / 2, -0.6), 0, 1, { closed: true, gap: 0.15 }).group);
  }
  if (st === "navratna") {
    const ring: [Gem, string][] = [["diamond", "#f4f6fb"], ["pearl", "#f3ede2"], ["coral", "#e2553a"], ["hessonite", "#c8641c"], ["sapphire", "#0c2394"], ["cats-eye", "#b9a24a"], ["yellow-sapphire", "#f2c230"], ["emerald", "#0b7a4b"]];
    const R = Math.max(c.lengthMm, c.widthMm) / 2;
    const dia = Math.max(2.4, R * 0.95);
    ring.forEach(([gem, color], i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      at(accents(m, gem, color, "faceted", [{ pos: v3(Math.cos(a) * (R + dia / 2 + 0.5), -0.4, Math.sin(a) * (R + dia / 2 + 0.5)), dia }]));
    });
    at(backingPlate(m, outlineFn("round", 1, 1), (R + dia + 1) * 2, -0.9, 0.8));
  }
  applyProfile(group, d, gy);
  if (decoTop && d.options.decoBend > 0) bendOverFinger(group, decoTop, d.options.decoBend, ringInnerDiameter(d.ringSize) / 2 + 2.1, d.band.widthMm / 2 + 1);
  bandPave(group, d, m);
  const top = new THREE.Box3().setFromObject(group).max.y;
  return { group, focus: v3(0, top - c.domeMm - 1, 0), focusSize: 26, upright: true };
}

function bandPave(group: THREE.Group, d: Design, m: Mats) {
  const b = d.band;
  if (b.pave === "none") return;
  const shank = group.children.find((o) => o.userData.shank) as THREE.Mesh | undefined;
  const RIN = ringInnerDiameter(d.ringSize) / 2;
  const top = shank?.userData.top as { topW: number; topT: number; spread: number } | undefined;
  const box = new THREE.Box3();
  group.updateWorldMatrix(true, true);
  group.children.forEach((o) => { if (o !== shank) box.expandByObject(o); });
  const hx = box.isEmpty() ? 0 : top ? top.spread : 3.2;
  const start = hx ? Math.asin(Math.min(0.9, (hx + 0.6) / (RIN + 2.3))) : 0;
  const end = b.pave === "shoulders" ? start + 0.75 : b.pave === "half" ? Math.PI / 2 + 0.15 : Math.PI;
  const mosaic = mosaicFrame(d);
  const rows = mosaic ? Math.max(3, Math.round((b.widthMm - 0.3) / (mosaic.widthMm * 0.75 * ASPECT[mosaic.shape] + 0.1))) : b.paveRows;
  const W = mosaic ? ((b.widthMm - 0.3) / rows - 0.08) / ASPECT[mosaic.shape] : b.paveMm;
  const ang = b.paveAngle;
  const pd: Design = mosaic
    ? { ...d, accents: { ...d.accents, gem: mosaic.gem, color: mosaic.color, cut: mosaic.cut === "cabochon" ? "cabochon" : "faceted", sizeCt: 6, orientation: "across",
        shapes: mosaic.alt ? [mosaic.shape, mosaic.shape, mosaic.alt.shape] : [mosaic.shape],
        turns: mosaic.alt ? [0, 0, 55] : [], twins: [], sizes: mosaic.alt ? [1, 1, 0.85] : [],
        colors: mosaic.alt ? [mosaic.color, mosaic.color, mosaic.alt.color] : [], ombre: [], layout: "line" } as Design["accents"] }
    : { ...d, accents: { ...d.accents, gem: b.paveGem, color: b.paveColor, cut: "faceted", sizeCt: 6, shapes: ang ? [b.paveShape, b.paveShape] : [b.paveShape], orientation: "along", turns: ang ? [ang, -ang] : [], twins: [], sizes: [], colors: [], ombre: b.paveOmbre, layout: "line" } };
  const arms = b.split > 0 && !mosaic ? [1, -1] : [0];
  const surf = (th: number) => { const s = bandSection(b.widthMm, th, top, b.shape, RIN); return { r: RIN + s.t, w: s.w }; };
  for (const sideSign of b.pave === "full" && !hx ? [1] : [1, -1]) {
    const a0 = sideSign * start, a1 = b.pave === "full" && !hx ? start + Math.PI * 2 : sideSign * end;
    for (const arm of arms) for (let r = 0; r < rows; r++) {
      const N = 120;
      const pts = Array.from({ length: N + 1 }, (_, i) => {
        const th = a0 + ((a1 - a0) * i) / N;
        const { r: R, w: w0 } = surf(th);
        const sp = arm ? splitArms(w0, th, b.split) : null;
        const w = sp ? sp.hi - sp.lo : w0;
        const z = (sp ? arm * (sp.lo + sp.hi) / 2 : 0) + (rows === 1 ? 0 : mosaic ? (r - (rows - 1) / 2) * ((w - 0.3) / rows) : (r / (rows - 1) - 0.5) * Math.max(0, Math.min(w - W - 0.4, (W + 0.25) * (rows - 1))));
        return v3(Math.sin(th) * (R - W * 0.16), Math.cos(th) * (R - W * 0.16), z);
      });
      const curve = new THREE.CatmullRomCurve3(pts, false);
      const g = patternRun(pd, m, curve, mosaic ? (r % 2) * 0.012 : 0, 1, { maxW: mosaic ? W * ASPECT[mosaic.shape] : W, gap: mosaic ? 0.08 : 0.2, fade: "start", up: (u) => { const p = curve.getPointAt(u); return v3(p.x, p.y, 0).normalize(); } }).group;
      g.userData.part = "accents";
      g.userData.keep = true;
      group.add(g);
    }
  }
}

function applyProfile(group: THREE.Group, d: Design, gy: number) {
  const prof = d.band.profile;
  if (prof === "raised") return;
  const shank = group.children.find((o) => o.userData.shank) as THREE.Mesh | undefined;
  if (!shank) return;
  const RIN = ringInnerDiameter(d.ringSize) / 2;
  const rest = group.children.filter((o) => o !== shank && !o.userData.onBand);
  const box = new THREE.Box3();
  group.updateWorldMatrix(true, true);
  rest.forEach((o) => box.expandByObject(o));
  if (box.isEmpty()) return;
  const hx = Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), hz = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
  const c = d.center;
  const belly = c.cut === "cabochon" ? Math.min(c.widthMm * 0.14, 2) : c.cut === "faceted" ? c.widthMm * 0.43 : Math.max(0.4, c.domeMm);
  let drop: number;
  if (prof === "flush") {
    const topT = Math.min(7, Math.max(2.6, belly + 0.7));
    const c0 = d.center;
    const prevTop = shank.userData.top as { topW: number; topT: number; spread: number } | undefined;
    const top = { topW: Math.max(d.band.widthMm + 1.4, c0.lengthMm * 0.92, prevTop?.topW ?? 0), topT: Math.max(topT, prevTop?.topT ?? 0), spread: Math.max(c0.widthMm / 2 + 0.3, prevTop?.spread ?? 0), round: !prevTop };
    shank.geometry.dispose();
    shank.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, top, d.band.shape, d.band.split);
    shank.userData.top = top;
    drop = gy - (RIN + top.topT + 0.05);
    if (drop > 0) rest.forEach((o) => (o.position.y -= drop));
    return;
  }
  if (prof === "set-in") {
    const target = RIN + Math.max(2.9, belly * 0.75 + 0.6);
    const topT = target - 0.3 - RIN;
    if (shank.userData.top) { drop = gy - target; rest.forEach((o) => (o.position.y -= drop)); return; }
    shank.geometry.dispose();
    shank.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, { topW: Math.max(d.band.widthMm + 1.6, hz * 2 + 0.4), topT, spread: hx * 0.95 }, d.band.shape, d.band.split);
    shank.userData.top = { topW: Math.max(d.band.widthMm + 1.6, hz * 2 + 0.4), topT, spread: hx * 0.95 };
    drop = gy - target;
  } else {
    drop = Math.max(0, gy - (RIN + 2.3 + belly * 0.25) + Math.min(1.2, d.setting.height * 4));
  }
  if (drop > 0) rest.forEach((o) => (o.position.y -= drop));
}

export function bendOverFinger(root: THREE.Object3D, part: THREE.Object3D, amount: number, floor: number, bandHalf: number) {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const box = new THREE.Box3().setFromObject(part);
  const R = box.max.y - 1;
  if (!(R > 1)) return;
  const edge = Math.max(Math.abs(box.min.x), box.max.x) * 0.6;
  let sideLow = Infinity;
  const w = new THREE.Vector3(), mm = new THREE.Matrix4();
  part.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, mm); w.setFromMatrixPosition(mm.premultiply(mesh.matrixWorld).premultiply(toRoot)); if (Math.abs(w.x) > edge) sideLow = Math.min(sideLow, w.y); }
      return;
    }
    const ps = mesh.geometry.getAttribute("position");
    mm.multiplyMatrices(toRoot, mesh.matrixWorld);
    for (let i = 0; i < ps.count; i += 3) { w.fromBufferAttribute(ps, i).applyMatrix4(mm); if (Math.abs(w.x) > edge) sideLow = Math.min(sideLow, w.y); }
  });
  const settle = Number.isFinite(sideLow) ? Math.min(4, Math.max(0, sideLow - floor)) : 0;
  const Rb = R / amount, yc = R - Rb;
  const place = (p: THREE.Vector3) => {
    const a = p.x / Rb, over = Math.abs(p.z) <= bandHalf;
    const sy = over ? p.y - settle * Math.min(1, Math.sin(a) ** 2 * 4) : p.y;
    const rho = Math.max(0.5, Rb + sy - R);
    const q = v3(rho * Math.sin(a), yc + rho * Math.cos(a), p.z);
    const r = Math.hypot(q.x, q.y);
    if (over && r < floor) { q.x *= floor / r; q.y *= floor / r; }
    return { a, p: q };
  };
  const rel = new THREE.Matrix4(), inv = new THREE.Matrix4(), mi = new THREE.Matrix4(), rz = new THREE.Matrix4();
  const pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  part.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    rel.multiplyMatrices(toRoot, mesh.matrixWorld);
    inv.copy(rel).invert();
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, mi);
        mi.premultiply(rel);
        mi.decompose(pos, q, sc);
        const { a, p } = place(pos);
        rz.makeRotationZ(-a);
        q.premultiply(new THREE.Quaternion().setFromRotationMatrix(rz));
        mi.compose(p, q, sc).premultiply(inv);
        inst.setMatrixAt(i, mi);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      inst.computeBoundingBox();
      return;
    }
    const geo = mesh.geometry.clone();
    const ps = geo.getAttribute("position") as THREE.BufferAttribute, ns = geo.getAttribute("normal") as THREE.BufferAttribute | undefined;
    const nm = new THREE.Matrix3().getNormalMatrix(rel), nmInv = new THREE.Matrix3().getNormalMatrix(inv);
    const v = new THREE.Vector3(), n = new THREE.Vector3();
    for (let i = 0; i < ps.count; i++) {
      v.fromBufferAttribute(ps, i).applyMatrix4(rel);
      const { a, p } = place(v);
      ps.setXYZ(i, ...p.applyMatrix4(inv).toArray());
      if (ns) { n.fromBufferAttribute(ns, i).applyMatrix3(nm).applyAxisAngle(new THREE.Vector3(0, 0, 1), -a).applyMatrix3(nmInv).normalize(); ns.setXYZ(i, n.x, n.y, n.z); }
    }
    ps.needsUpdate = true;
    if (ns) ns.needsUpdate = true;
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    mesh.geometry = geo;
  });
}
