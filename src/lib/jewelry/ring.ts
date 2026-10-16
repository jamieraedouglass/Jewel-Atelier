import * as THREE from "three";
import { type Design, type Gem, ringInnerDiameter } from "../design";
import { bandSection, buildRing, outlineFn, shankGeo } from "../ringModel";
import { type Piece, v3 } from "./common";
import { type Mats, makeMaterials } from "./materials";
import { setStoneRaw, tube } from "./stones";
import { accents, aroundOutline, backingPlate, balls } from "./elements";
import { halo, outlineCurve, patternMaxW, patternRun } from "./patterns";
import { decoFrames, flowerCluster, halfFlower, swirlArms } from "./ringHeads";

export function ringPiece(d: Design): Piece {
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
    // a broad band; rows of stones all the way round, on the edges (gold between) or across the whole width
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const bw = Math.max(d.band.widthMm, 3);
    const innerMat = (m.metal as THREE.MeshPhysicalMaterial).clone(); innerMat.side = THREE.DoubleSide;
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
    // a plain band
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const sh = new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish, undefined, d.band.shape), m.metal);
    sh.userData.shank = true;
    group.add(sh);
    bandPave(group, d, m);
    return { group, focus: v3(0, RIN, 0), focusSize: 24, upright: true };
  }
  const base = st === "three-stone" || st === "halo" ? d : { ...d, sides: { ...d.sides, kind: "none" as const } };
  const group = buildRing(base);
  if (st === "two-stone" && d.extraStones[0]) {
    // toi-et-moi: shift the main stone's head aside and set the partner stone beside it
    const e = d.extraStones[0];
    const head: THREE.Group | undefined = group.userData.head;
    const reach = (L: number, W: number, deg: number) => { const r = THREE.MathUtils.degToRad(deg); return (Math.abs(Math.cos(r)) * W + Math.abs(Math.sin(r)) * L) / 2; };
    const a = reach(d.center.lengthMm, d.center.widthMm, d.center.rotation), b = reach(e.lengthMm, e.widthMm, e.rotation);
    if (head) head.position.x = -(a + 0.4);
    const gy0: number = group.userData.girdleY ?? 12;
    const mm = makeMaterials(d);
    const partner = setStoneRaw({ ...d.center, ...e, carat: null, label: "", photoPath: null, rotation: 0, none: false }, d.setting.style, mm);
    partner.rotation.y = THREE.MathUtils.degToRad(e.rotation);
    partner.position.set(b + 0.4 + e.dx, gy0, e.dz);
    partner.userData.part = "extra";
    group.add(partner);
    if (d.options.halo) {
      // a surround round each stone (baguettes, pavé, any shape in the accent pattern)
      const hm = halo(d, mm, d.center); hm.group.position.set(-(a + 0.4), gy0, 0); hm.group.rotation.y = THREE.MathUtils.degToRad(d.center.rotation); group.add(hm.group);
      const pc = { ...d.center, ...e, carat: null, label: "", photoPath: null, rotation: 0, none: false };
      const hp = halo(d, mm, pc); hp.group.position.set(b + 0.4 + e.dx, gy0, e.dz); hp.group.rotation.y = THREE.MathUtils.degToRad(e.rotation); group.add(hp.group);
    }
    // a bridge under both stones into the shank
    group.add(tube(mm, [v3(-(a + 0.4), gy0 - 1.6, 0), v3(0, gy0 - 2.4, 0), v3(b + 0.4 + e.dx, gy0 - 1.6, e.dz)], 0.6));
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
  if (st === "deco") at(decoFrames(d, m, c).group);
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
    // traditional order around the ruby (sun): diamond, pearl, coral, hessonite, blue sapphire, cat's eye, yellow sapphire, emerald
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
  bandPave(group, d, m);
  const top = new THREE.Box3().setFromObject(group).max.y;
  return { group, focus: v3(0, top - c.domeMm - 1, 0), focusSize: 26, upright: true };
}

/**
 * How the design meets the band. raised: up on its setting (as built). low: brought down close to the band.
 * set-in: the band widens and deepens across the top and the design is lowered into it, girdle level with the metal.
 */
/**
 * Stones running down the band from the head: on the shoulders, half way round, or all the way (an eternity shank).
 * They sit in the band's top surface, following its real thickness and width, in 1–4 rows.
 */
function bandPave(group: THREE.Group, d: Design, m: Mats) {
  const b = d.band;
  if (b.pave === "none") return;
  const shank = group.children.find((o) => o.userData.shank) as THREE.Mesh | undefined;
  const RIN = ringInnerDiameter(d.ringSize) / 2;
  const top = shank?.userData.top as { topW: number; topT: number; spread: number } | undefined;
  // where the head ends, so the stones start just past it
  const box = new THREE.Box3();
  group.updateWorldMatrix(true, true);
  group.children.forEach((o) => { if (o !== shank) box.expandByObject(o); });
  // the head meets the band only where its posts come down (about 3 mm either side), however wide the top is;
  // a design set into the band covers the band as far as the widened top reaches
  const hx = box.isEmpty() ? 0 : top ? top.spread : 3.2;
  const start = hx ? Math.asin(Math.min(0.9, (hx + 0.6) / (RIN + 2.3))) : 0;
  const end = b.pave === "shoulders" ? start + 0.75 : b.pave === "half" ? Math.PI / 2 + 0.15 : Math.PI;
  const rows = b.paveRows;
  const W = b.paveMm;
  // a vine: elongated stones (marquise leaves) angled alternately left and right along the band
  const ang = b.paveAngle;
  const pd: Design = { ...d, accents: { ...d.accents, gem: b.paveGem, color: b.paveColor, cut: "faceted", sizeCt: 6, shapes: ang ? [b.paveShape, b.paveShape] : [b.paveShape], orientation: "along", turns: ang ? [ang, -ang] : [], twins: [], sizes: [], colors: [] } };
  const surf = (th: number) => { const s = bandSection(b.widthMm, th, top, b.shape, RIN); return { r: RIN + s.t, w: s.w }; };
  for (const sideSign of b.pave === "full" && !hx ? [1] : [1, -1]) {
    const a0 = sideSign * start, a1 = b.pave === "full" && !hx ? start + Math.PI * 2 : sideSign * end;
    for (let r = 0; r < rows; r++) {
      const N = 120;
      const pts = Array.from({ length: N + 1 }, (_, i) => {
        const th = a0 + ((a1 - a0) * i) / N;
        const { r: R, w } = surf(th);
        const z = rows === 1 ? 0 : (r / (rows - 1) - 0.5) * Math.max(0, Math.min(w - W - 0.4, (W + 0.25) * (rows - 1)));
        // set down into the metal: the table sits about level with the band's surface
        return v3(Math.sin(th) * (R - W * 0.16), Math.cos(th) * (R - W * 0.16), z);
      });
      const curve = new THREE.CatmullRomCurve3(pts, false);
      const g = patternRun(pd, m, curve, 0, 1, { maxW: W, gap: 0.2, up: (u) => { const p = curve.getPointAt(u); return v3(p.x, p.y, 0).normalize(); } }).group;
      g.userData.part = "accents";
      g.userData.keep = true; // band stones have their own on/off (band.pave)
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
  // stones already curving in the band stay where they are
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
    // centre stone level with the band: its girdle sits just at the band's surface, the band deep and wide enough
    // under it to hold the whole stone, so nothing stands up off the band
    const topT = Math.min(7, Math.max(2.6, belly + 0.7));
    const c0 = d.center;
    const prevTop = shank.userData.top as { topW: number; topT: number; spread: number } | undefined;
    // only as wide as the stone needs right under it (a tapered cathedral), not a platform
    const top = { topW: Math.max(d.band.widthMm + 1.4, c0.lengthMm * 0.92, prevTop?.topW ?? 0), topT: Math.max(topT, prevTop?.topT ?? 0), spread: Math.max(c0.widthMm / 2 + 0.3, prevTop?.spread ?? 0), round: !prevTop };
    shank.geometry.dispose();
    shank.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, top, d.band.shape);
    shank.userData.top = top;
    drop = gy - (RIN + top.topT + 0.05);
    if (drop > 0) rest.forEach((o) => (o.position.y -= drop));
    return;
  }
  if (prof === "set-in") {
    // the girdle ends up just above the band's top surface; the pavilion may open into the finger hole (an open gallery)
    const target = RIN + Math.max(2.9, belly * 0.75 + 0.6);
    const topT = target - 0.3 - RIN;
    if (shank.userData.top) { drop = gy - target; rest.forEach((o) => (o.position.y -= drop)); return; } // band already built for stones in it
    shank.geometry.dispose();
    shank.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, { topW: Math.max(d.band.widthMm + 1.6, hz * 2 + 0.4), topT, spread: hx * 0.95 }, d.band.shape);
    shank.userData.top = { topW: Math.max(d.band.widthMm + 1.6, hz * 2 + 0.4), topT, spread: hx * 0.95 };
    drop = gy - target;
  } else {
    drop = Math.max(0, gy - (RIN + 2.3 + belly * 0.25) + Math.min(1.2, d.setting.height * 4));
  }
  if (drop > 0) rest.forEach((o) => (o.position.y -= drop));
}
