import * as THREE from "three";
import { NO_CHARACTER, type CenterStone, type Design, type Gem, ringInnerDiameter } from "../design";
import { bandSection, buildRing, outlineFn, shankGeo, splitArms } from "../ringModel";
import { type Piece, v3 } from "./common";
import { type Mats, makeMaterials } from "./materials";
import { setStoneRaw, tube } from "./stones";
import { ASPECT, accents, aroundOutline, backingPlate, balls } from "./elements";
import { halo, outlineCurve, patternMaxW, patternRun } from "./patterns";
import { decoFrames, flowerCluster, halfFlower, sprayDome, swirlArms } from "./ringHeads";
import { bombeHead, isBombe } from "./bombe";
import { handPolished } from "../polish";

function edgeX(shape: CenterStone["shape"], L: number, W: number, deg: number, side: 1 | -1): number {
  const fn = outlineFn(shape, L, W), r = THREE.MathUtils.degToRad(deg), cos = Math.cos(r), sin = Math.sin(r);
  let most = 0;
  for (let i = 0; i < 180; i++) { const [x, z] = fn(i / 180); most = Math.max(most, side * (x * cos + z * sin)); }
  return most;
}

function mosaicFrame(d: Design) {
  if (d.type !== "ring" || d.style !== "deco" || !d.options.decoWrap) return null;
  const stoneLayers = d.frames.filter((f) => f.kind === "fill" || f.kind === "stones");
  return stoneLayers[stoneLayers.length - 1] ?? null;
}

const TOP_PARTS = new Set(["center", "sides", "extra", "accents", "motif"]);
function topSize(p: Piece, rotation: number) {
  const b = new THREE.Box3();
  p.group.updateMatrixWorld(true);
  p.group.traverse((o) => { if (TOP_PARTS.has(o.userData.part)) b.expandByObject(o); });
  if (b.isEmpty()) return { L: 0, W: 0 };
  const x = b.max.x - b.min.x, z = b.max.z - b.min.z, across = Math.abs(Math.cos(THREE.MathUtils.degToRad(rotation))) > 0.7;
  return across ? { L: z, W: x } : { L: x, W: z };
}
function dispose(g: THREE.Object3D) { g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }

// The stones round the edge and the bend over the finger both add to the top, so a measured size is checked on the
// finished ring and the fit aimed again until it matches.
export function ringPiece(d00: Design): Piece {
  // In a bombé dome the centre stone sits down in the dome, not up on a collar.
  if (isBombe(d00)) return ringPieceOnce({ ...d00, setting: { ...d00.setting, height: 0 } });
  let d0 = d00;
  const o = d0.options, wantL = o.decoLengthMm, wantW = o.decoWidthMm;
  if (d0.type !== "ring" || d0.style !== "deco" || !(wantL > 0 || wantW > 0) || !d0.frames.length) return ringPieceOnce(d0);
  // Layers too wide for the measured top are made finer (smaller stones, narrower bands) instead of being squashed.
  const natural = ringPieceOnce({ ...d0, options: { ...o, decoLengthMm: 0, decoWidthMm: 0, decoSpread: 0 } });
  const nat = topSize(natural, d0.center.rotation);
  dispose(natural.group);
  const c = d0.center, rim = (half: number, want: number, now: number) => (want > 0 && now / 2 > half + 1 ? (want / 2 - half) / (now / 2 - half) : 1);
  const f = Math.min(rim(c.lengthMm / 2 + 0.6, wantL, nat.L), rim(c.widthMm / 2 + 0.6, wantW, nat.W));
  if (f < 0.92) {
    const k = Math.max(0.35, f);
    d0 = { ...d0, frames: d0.frames.map((fr) => ({ ...fr, widthMm: Math.max(0.4, fr.widthMm * k), gapMm: fr.gapMm * k })) };
  }
  let p = ringPieceOnce(d0);
  let aimL = wantL, aimW = wantW;
  for (let i = 0; i < 3; i++) {
    const { L, W } = topSize(p, d0.center.rotation);
    const overL = wantL > 0 ? L - wantL : 0, overW = wantW > 0 ? W - wantW : 0;
    if (Math.abs(overL) < 0.3 && Math.abs(overW) < 0.3) break;
    if (wantL > 0) aimL = Math.max(wantL * 0.5, aimL - overL);
    if (wantW > 0) aimW = Math.max(wantW * 0.5, aimW - overW);
    dispose(p.group);
    p = ringPieceOnce({ ...d0, options: { ...o, decoLengthMm: aimL, decoWidthMm: aimW } });
  }
  return p;
}

function ringPieceOnce(d0: Design): Piece {
  const mosaic = mosaicFrame(d0);
  // A mosaic top carries its stones down the shoulders; the band behind stays as designed (often slim and plain).
  const d: Design = mosaic ? { ...d0, band: { ...d0.band, widthMm: Math.max(d0.band.widthMm, 1.8), pave: d0.band.pave === "none" || d0.band.pave === "full" ? "shoulders" : d0.band.pave } } : d0;
  const m = makeMaterials(d);
  const st = d.style;
  if (st === "eternity") {
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const band = new THREE.Mesh(shankGeo(RIN, Math.max(d.band.widthMm, 2.6), "polished"), m.metal);
    group.add(band);
    const Ro = RIN + 1.75;
    const circle = new THREE.CatmullRomCurve3(Array.from({ length: 128 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return v3(Math.sin(a) * Ro, Math.cos(a) * Ro, 0); }), true);
    group.add(patternRun(d, m, circle, 0, 1, { editKey: "eternity", closed: true, maxW: Math.max(d.band.widthMm, 2.6) * 0.9, up: (u) => circle.getPointAt(u).normalize(), offset: (u) => circle.getPointAt(u).normalize().multiplyScalar(0.05), gap: 0.25 }).group);
    return { group, focus: v3(0, Ro, 0), focusSize: 18, upright: true };
  }
  if (st === "wide-band") {
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const bw = Math.max(d.band.widthMm, 3);
    const innerMat = handPolished((m.metal as THREE.MeshPhysicalMaterial).clone()); innerMat.side = THREE.DoubleSide;
    const ring = new THREE.LatheGeometry([new THREE.Vector2(RIN, -bw / 2), new THREE.Vector2(RIN + 1.9, -bw / 2), new THREE.Vector2(RIN + 1.9, bw / 2), new THREE.Vector2(RIN, bw / 2), new THREE.Vector2(RIN, -bw / 2)], 160);
    const band = new THREE.Mesh(ring, innerMat);
    band.rotation.x = Math.PI / 2;
    group.add(band);
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
      group.add(patternRun(d, m, circle, 0, 1, { editKey: `wide${zs.indexOf(z)}`, closed: true, up: (u) => circle.getPointAt(u).normalize(), offset: (u) => circle.getPointAt(u).normalize().multiplyScalar(0.02).add(v3(0, 0, z)), gap: 0.2, maxW: W }).group);
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
  if (st === "deco" && isBombe(d)) {
    decoTop = bombeHead(d, m, c, { r: ringInnerDiameter(d.ringSize) / 2 + 0.6, gy }).group;
    at(decoTop);
  } else if (st === "deco") {
    decoTop = decoFrames(d, m, c, -0.15, 0, { r: ringInnerDiameter(d.ringSize) / 2 + 0.6, gy }).group;
    const t = THREE.MathUtils.degToRad(c.rotation), across = v3(Math.cos(t), 0, -Math.sin(t)), along = v3(Math.sin(t), 0, Math.cos(t));
    const fromW = c.widthMm / 2 + 0.6, fromL = c.lengthMm / 2 + 0.6;
    const o = d.options;
    // An outer fill already reaches the measured size itself; stretching it again would pull its stones apart.
    const selfSized = d.frames[d.frames.length - 1]?.kind === "fill" && (o.decoLengthMm > 0 || o.decoWidthMm > 0);
    if (d.options.decoSpread > 0 && !selfSized) stretchAxis(decoTop, across, 1 + 0.7 * d.options.decoSpread, fromW);
    if (!selfSized) for (const [axis, from, want, cap] of [[along, fromL, o.decoLengthMm, 34], [across, fromW, o.decoWidthMm, 32]] as const) {
      for (let pass = 0; pass < 3; pass++) {
        const now = reach(decoTop, axis), target = (want > 0 ? want : Math.min(now * 2, cap)) / 2;
        if (!(now > from + 1 && Math.abs(target - now) > 0.2)) break;
        stretchAxis(decoTop, axis, Math.min(1.8, Math.max(0.45, (target - from) / (now - from))), from);
      }
    }
    at(decoTop);
  }
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
    at(patternRun(d, m, outlineCurve(c, 0.35 + dia / 2, -0.6), 0, 1, { editKey: "cluster", closed: true, gap: 0.15 }).group);
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
  if (decoTop && d.options.decoBend > 0 && !isBombe(d)) bendOverFinger(group, decoTop, d.options.decoBend, ringInnerDiameter(d.ringSize) / 2 + 2.1, d.band.widthMm / 2 + 1);
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
  // A mosaic keeps its stones the same size and spacing, adding rows where the shoulders flare wider, so the whole
  // shoulder is set rather than a few rows spread thin across it.
  const pz = (b.widthMm - 0.3) / rows;
  for (const sideSign of b.pave === "full" && !hx ? [1] : [1, -1]) {
    const a0 = sideSign * start, a1 = b.pave === "full" && !hx ? start + Math.PI * 2 : sideSign * end;
    if (mosaic) {
      let widest = 0;
      for (let i = 0; i <= 60; i++) widest = Math.max(widest, surf(a0 + ((a1 - a0) * i) / 60).w);
      const rowsM = Math.max(rows, Math.floor((widest - 0.3) / pz));
      for (let r = 0; r < rowsM; r++) {
        const z = (r - (rowsM - 1) / 2) * pz, N = 120;
        let run: THREE.Vector3[] = [], best: THREE.Vector3[] = [];
        for (let i = 0; i <= N; i++) {
          const th = a0 + ((a1 - a0) * i) / N, { r: R, w } = surf(th);
          if (Math.abs(z) <= (w - 0.3) / 2 - pz * 0.35) { run.push(v3(Math.sin(th) * (R - W * 0.16), Math.cos(th) * (R - W * 0.16), z)); if (run.length > best.length) best = run; }
          else run = [];
        }
        if (best.length < 4) continue;
        const curve = new THREE.CatmullRomCurve3(best, false);
        if (curve.getLength() < pz * 1.5) continue;
        const g = patternRun(pd, m, curve, (r % 2) * 0.012, 1, { maxW: W * ASPECT[mosaic.shape], gap: 0.08, fade: "start", editKey: `band${sideSign}0${r}`, up: (u) => { const p = curve.getPointAt(u); return v3(p.x, p.y, 0).normalize(); } }).group;
        g.userData.part = "accents";
        g.userData.keep = true;
        group.add(g);
      }
      continue;
    }
    for (const arm of arms) for (let r = 0; r < rows; r++) {
      const N = 120;
      const pts = Array.from({ length: N + 1 }, (_, i) => {
        const th = a0 + ((a1 - a0) * i) / N;
        const { r: R, w: w0 } = surf(th);
        const sp = arm ? splitArms(w0, th, b.split) : null;
        const w = sp ? sp.hi - sp.lo : w0;
        const z = (sp ? arm * (sp.lo + sp.hi) / 2 : 0) + (rows === 1 ? 0 : (r / (rows - 1) - 0.5) * Math.max(0, Math.min(w - W - 0.4, (W + 0.25) * (rows - 1))));
        return v3(Math.sin(th) * (R - W * 0.16), Math.cos(th) * (R - W * 0.16), z);
      });
      const curve = new THREE.CatmullRomCurve3(pts, false);
      const g = patternRun(pd, m, curve, 0, 1, { maxW: W, gap: 0.2, fade: "start", editKey: `band${sideSign}${arm}${r}`, up: (u) => { const p = curve.getPointAt(u); return v3(p.x, p.y, 0).normalize(); } }).group;
      g.userData.part = "accents";
      g.userData.keep = true;
      group.add(g);
    }
  }
}

function applyProfile(group: THREE.Group, d: Design, gy: number) {
  const prof = d.band.profile;
  const shank = group.children.find((o) => o.userData.shank) as THREE.Mesh | undefined;
  // A mosaic dome carried on down the shoulders: the shoulders flare up to meet the dome, widest where they join it,
  // and narrow to the band, so the mosaic has a sweep of shoulder to run down rather than a thin wire under a cap.
  const bombe = d.style === "deco" && sprayDome(d);
  if (bombe && shank && !shank.userData.top) {
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const box = new THREE.Box3();
    group.updateWorldMatrix(true, true);
    group.children.forEach((o) => { if (o !== shank && !o.userData.onBand) box.expandByObject(o); });
    if (!box.isEmpty()) {
      const hx = Math.max(Math.abs(box.min.x), Math.abs(box.max.x)), hz = Math.max(Math.abs(box.min.z), Math.abs(box.max.z));
      const top = { topW: Math.min(9, Math.max(d.band.widthMm + 2, hz * 0.7)), topT: 1.3, spread: hx * 0.97 };
      shank.geometry.dispose();
      shank.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, top, d.band.shape, d.band.split);
      shank.userData.top = top;
    }
    return;
  }
  if (prof === "raised") return;
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
    const prevTop = shank.userData.top as { topW: number; topT: number; spread: number } | undefined;
    const top = { topW: Math.max(d.band.widthMm + 1.4, c.lengthMm * 0.92, prevTop?.topW ?? 0), topT: Math.max(topT, prevTop?.topT ?? 0), spread: Math.max(c.widthMm / 2 + 0.3, prevTop?.spread ?? 0), round: !prevTop };
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
    const top = { topW: Math.max(d.band.widthMm + 1.6, hz * 2 + 0.4), topT, spread: hx * 0.95 };
    shank.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, top, d.band.shape, d.band.split);
    shank.userData.top = top;
    drop = gy - target;
  } else {
    drop = Math.max(0, gy - (RIN + 2.3 + belly * 0.25) + Math.min(1.2, d.setting.height * 4));
  }
  if (drop > 0) rest.forEach((o) => (o.position.y -= drop));
}

function bendOverFinger(root: THREE.Object3D, part: THREE.Object3D, amount: number, floor: number, bandHalf: number) {
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
  const cap = 1.05;
  const place = (p: THREE.Vector3) => {
    const sgn = p.x < 0 ? -1 : 1, a0 = Math.abs(p.x) / Rb, a = sgn * Math.min(cap, a0), over = Math.abs(p.z) <= bandHalf;
    const sy = over ? p.y - settle * Math.min(1, Math.sin(a) ** 2 * 4) : p.y;
    const rho = Math.max(0.5, Rb + sy - R), run = Math.max(0, a0 - cap) * Rb;
    const q = v3(rho * Math.sin(a) + sgn * Math.cos(cap) * run, yc + rho * Math.cos(a) - Math.sin(cap) * run, p.z);
    const r = Math.hypot(q.x, q.y);
    if (over && r < floor) { q.x *= floor / r; q.y *= floor / r; }
    return { a, p: q };
  };
  const rz = new THREE.Matrix4(), pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  reshape(part, toRoot, (mi) => {
    mi.decompose(pos, q, sc);
    const { a, p } = place(pos);
    rz.makeRotationZ(-a);
    q.premultiply(new THREE.Quaternion().setFromRotationMatrix(rz));
    mi.compose(p, q, sc);
  }, (v) => { const { a, p } = place(v); return { p, turn: -a }; }, "turn");
}

// Reshape every mesh in `part`, working in the frame `toFrame` maps into: each instance (a stone, a bead) is moved whole
// by `instance`, and every vertex of the other meshes by `vertex`. Normals either turn about the finger's axis by the
// angle `vertex` gives, or are worked out afresh. Geometry is cloned, as other parts may share it.
function reshape(part: THREE.Object3D, toFrame: THREE.Matrix4, instance: (m: THREE.Matrix4) => void,
  vertex: (v: THREE.Vector3) => { p: THREE.Vector3; turn?: number }, normals: "turn" | "recompute") {
  const rel = new THREE.Matrix4(), inv = new THREE.Matrix4(), mi = new THREE.Matrix4();
  part.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    rel.multiplyMatrices(toFrame, mesh.matrixWorld);
    inv.copy(rel).invert();
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, mi);
        mi.premultiply(rel);
        instance(mi);
        mi.premultiply(inv);
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
      const { p, turn = 0 } = vertex(v);
      ps.setXYZ(i, ...p.applyMatrix4(inv).toArray());
      if (normals === "turn" && ns) { n.fromBufferAttribute(ns, i).applyMatrix3(nm).applyAxisAngle(new THREE.Vector3(0, 0, 1), turn).applyMatrix3(nmInv).normalize(); ns.setXYZ(i, n.x, n.y, n.z); }
    }
    ps.needsUpdate = true;
    if (normals === "turn") { if (ns) ns.needsUpdate = true; }
    else geo.computeVertexNormals();
    geo.computeBoundingBox(); geo.computeBoundingSphere();
    mesh.geometry = geo;
  });
}

function reach(part: THREE.Object3D, axis: THREE.Vector3) {
  part.updateMatrixWorld(true);
  const toPart = part.matrixWorld.clone().invert(), m = new THREE.Matrix4(), v = new THREE.Vector3();
  let most = 0;
  part.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const rel = new THREE.Matrix4().multiplyMatrices(toPart, mesh.matrixWorld);
    const inst = o as THREE.InstancedMesh;
    if (inst.isInstancedMesh) {
      if (!inst.geometry.boundingBox) inst.geometry.computeBoundingBox();
      const b = inst.geometry.boundingBox!, corners = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => v3(k & 1 ? b.max.x : b.min.x, k & 2 ? b.max.y : b.min.y, k & 4 ? b.max.z : b.min.z));
      for (let i = 0; i < inst.count; i++) {
        inst.getMatrixAt(i, m); m.premultiply(rel);
        for (const c of corners) { v.copy(c).applyMatrix4(m); most = Math.max(most, Math.abs(v.dot(axis))); }
      }
      return;
    }
    const ps = mesh.geometry.getAttribute("position");
    for (let i = 0; i < ps.count; i += 2) { v.fromBufferAttribute(ps, i).applyMatrix4(rel); most = Math.max(most, Math.abs(v.dot(axis))); }
  });
  return most;
}

function stretchAxis(part: THREE.Object3D, axis: THREE.Vector3, k: number, from: number) {
  part.updateMatrixWorld(true);
  const toPart = part.matrixWorld.clone().invert();
  // A stretch by k along `axis`: into the axis's frame, scale, and back out.
  const B = new THREE.Matrix4().makeBasis(axis, v3(0, 1, 0), v3().crossVectors(axis, v3(0, 1, 0)));
  const J = B.clone().multiply(new THREE.Matrix4().makeScale(k, 1, 1)).multiply(B.clone().transpose());
  const move = (p: THREE.Vector3) => { const u = p.dot(axis), extra = (k - 1) * Math.max(0, Math.abs(u) - from) * Math.sign(u); return { p: p.clone().addScaledVector(axis, extra), far: Math.abs(u) > from }; };
  const t = new THREE.Vector3(), lin = new THREE.Matrix4();
  reshape(part, toPart, (mi) => {
    t.setFromMatrixPosition(mi);
    const { p, far } = move(t);
    lin.copy(mi).setPosition(0, 0, 0);
    if (far) lin.premultiply(J);
    mi.copy(lin).setPosition(p);
  }, (v) => ({ p: move(v).p }), "recompute");
}
