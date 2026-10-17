import * as THREE from "three";
import { type CenterStone, type Design } from "../design";
import { outlineFn } from "../ringModel";
import { Y, v3 } from "./common";
import { type Mats } from "./materials";
import { ASPECT, type Item, accents, balls } from "./elements";
import { patternMaxW, patternRun } from "./patterns";
import { tube } from "./stones";
import { handPolished } from "../polish";

/* ================= Art Deco layers ================= */

/**
 * Layers built outward from the centre stone. Each layer's inner edge is sized so it clears the layer inside it
 * all the way round, whatever the two shapes are (a round ring of calibré inside a hexagon of pavé, say).
 */
export function decoFrames(d: Design, m: Mats, c: CenterStone, y0 = -0.15, pass = 0): { group: THREE.Group; extent: number } {
  const g = new THREE.Group();
  g.userData.part = "accents";
  g.userData.keep = true; // the Deco layers are the design, not optional accents
  const N = 180;
  const theta = (x: number, z: number) => (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
  // radius of the boundary so far, by direction
  const prev = new Float32Array(N);
  { const fn = outlineFn(c.shape, c.lengthMm + 0.5, c.widthMm + 0.5); for (let k = 0; k < 720; k++) { const [x, z] = fn(k / 720); const b = Math.floor((theta(x, z) / (Math.PI * 2)) * N) % N; prev[b] = Math.max(prev[b], Math.hypot(x, z)); } }
  for (let b = 0; b < N; b++) if (!prev[b]) prev[b] = prev[(b + N - 1) % N];
  const prevAt = (a: number) => prev[Math.floor((a / (Math.PI * 2)) * N) % N];
  // keep the whole top to a size that can be worn: if the layers would grow past it, they're made finer to fit
  const centreHalf = Math.max(c.lengthMm, c.widthMm) / 2 + 0.5;
  const maxHalf = Math.max(centreHalf + 4, d.type === "ring" ? 16 : 12); // a big cocktail ring top runs to ~32 mm
  const growth = d.frames.reduce((a, f) => a + f.gapMm + (f.kind === "stones" ? (f.direction === "radial" ? f.widthMm * ASPECT[f.shape] : f.widthMm) : f.kind === "milgrain" ? 0.55 : f.widthMm), 0);
  const fit = centreHalf + growth > maxHalf ? Math.max(0.05, (maxHalf - centreHalf) / growth) : 1;
  const frames = fit < 1 ? d.frames.map((f) => ({ ...f, widthMm: Math.max(0.6, f.widthMm * fit), gapMm: f.gapMm * fit })) : d.frames;
  // a domed (bombé) top: each layer sits lower the further out it is, and its stones tilt out with the curve
  const dome = d.options.decoDome;
  const Rd = dome > 0 ? 70 - 45 * dome : 0; // the dome's radius of curvature, mm (smaller is higher)
  const r0 = centreHalf - 0.5;
  const domeY = (r: number) => y0 - Math.max(0, r * r - r0 * r0) / (2 * Rd);
  const tilt = (p: THREE.Vector3) => v3(p.x / Rd, 1, p.z / Rd).normalize();
  let y = y0, outer: THREE.Vector3[] = [];
  frames.forEach((f) => {
    const stoneL = f.widthMm * ASPECT[f.shape];
    const thick = f.kind === "stones" ? (f.direction === "radial" ? stoneL : f.widthMm) : f.kind === "milgrain" ? 0.55 : f.widthMm;
    // the layer's own shape, scaled up until its inner edge clears everything inside
    const unit = outlineFn(f.outline, c.lengthMm + 1, c.widthMm + 1);
    const S = 240, raw = Array.from({ length: S }, (_, k) => unit(k / S));
    let kScale = 0;
    for (const [x, z] of raw) kScale = Math.max(kScale, (prevAt(theta(x, z)) + f.gapMm) / (Math.hypot(x, z) || 1));
    if (dome > 0) y = domeY(raw.reduce((a, [x, z]) => a + Math.hypot(x, z), 0) / S * kScale + thick / 2);
    const ring = (extra: number) => raw.map(([x, z]) => { const r = Math.hypot(x, z) || 1, rr = r * kScale + extra; return v3((x / r) * rr, y, (z / r) * rr); });
    const centre = new THREE.CatmullRomCurve3(ring(thick / 2), true, "centripetal");
    if (f.kind === "stones") {
      const pd: Design = { ...d, accents: { ...d.accents, gem: f.gem, color: f.color, cut: (f.cut === "polki" || f.cut === "rose-cut" || f.cut === "briolette" || f.cut === "bead" ? f.cut : "faceted") as Design["accents"]["cut"], sizeCt: 6, shapes: [f.shape], orientation: f.direction === "radial" ? "across" : "along", turns: [], twins: [], colors: [] } };
      const main = { gem: f.gem, color: f.color, cut: f.cut, shape: f.shape };
      const alt = f.alt ? { gem: f.alt.gem, color: f.alt.color, cut: f.alt.cut, shape: f.alt.shape } : null;
      g.add(patternRun(pd, m, centre, 0, 1, { closed: true, gap: 0.14, maxW: thick, gemAt: (i) => (alt && i % (f.every + 1) === f.every ? alt : main), ...(dome > 0 ? { up: (u: number) => tilt(centre.getPointAt(u)) } : {}) }).group);
    } else if (f.kind === "milgrain") {
      const n = Math.max(12, Math.round(centre.getLength() / 0.5));
      // satin beads: rows of mirror-bright beads each catch a highlight and blur into a glowing band
      g.add(balls(m.satin, Array.from({ length: n }, (_, k) => ({ pos: centre.getPointAt(k / n).add(v3(0, 0.12, 0)), dia: 0.42 }))));
    } else {
      const band = new THREE.Mesh(new THREE.TubeGeometry(centre, 240, thick / 2, 8, true), m.metal);
      band.scale.y = 0.6; band.position.y = (1 - 0.6) * y;
      g.add(band);
    }
    outer = ring(thick);
    for (const p of outer) { const a = theta(p.x, p.z), b = Math.floor((a / (Math.PI * 2)) * N) % N; prev[b] = Math.max(prev[b], Math.hypot(p.x, p.z)); }
    for (let b = 0; b < N; b++) prev[b] = Math.max(prev[b], Math.min(prev[(b + 1) % N], prev[(b + N - 1) % N]));
    if (!(dome > 0)) y -= 0.12; // a gentle dome, like a cocktail ring
  });
  if (outer.length && dome > 0) {
    // the plate follows the dome: rings of points from the centre out to the outer edge, lifted onto the curve
    const plate = new THREE.Mesh(domedPlate(outer.map((p) => new THREE.Vector2(p.x, p.z)), (r) => domeY(r) - 0.75, 1.6), plateMetal(m));
    plate.userData.part = "metal";
    g.add(plate);
  } else if (outer.length) {
    // the gold plate everything is set into
    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 3, curveSegments: 8 });
    geo.rotateX(Math.PI / 2); geo.translate(0, y - 0.75, 0);
    // not a slab: the sides taper in underneath, like a cocktail ring's gallery narrowing down to the band
    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox!;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - min.y) / Math.max(1e-6, max.y - min.y); // 0 underneath, 1 on top
      const k = 0.62 + 0.38 * Math.pow(t, 0.6);
      pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    const plate = new THREE.Mesh(geo, plateMetal(m));
    plate.userData.part = "metal";
    g.add(plate);
  }
  let extent = 0;
  for (let b = 0; b < N; b++) extent = Math.max(extent, prev[b]);
  // layers of different shapes leave room round each other, so the first fit can still come out too big: measure, and
  // if it has, build again with the layers made finer by what's left over
  if (extent > maxHalf * 1.12 && pass < 3) {
    const k = Math.max(0.2, (maxHalf - centreHalf) / Math.max(0.1, extent - centreHalf));
    // (the first attempt was never drawn, so there's nothing to free)
    return decoFrames({ ...d, frames: frames.map((f) => ({ ...f, widthMm: Math.max(0.6, f.widthMm * k), gapMm: f.gapMm * k })) }, m, c, y0, pass + 1);
  }
  return { group: g, extent };
}

/** the metal of a broad plate under stones */
function plateMetal(m: Mats) {
  // a satin finish, as a jeweller would leave it, so it reads as metal rather than a black mirror
  const satin = handPolished((m.metal as THREE.MeshPhysicalMaterial).clone());
  satin.roughness = 0.62;
  satin.envMapIntensity = 0.3;
  // a little deeper in tone: flat and facing the lamp, it would otherwise mirror it straight back as a white panel
  satin.color = satin.color.clone().multiplyScalar(0.72);
  // no glossy clear coat: on a plate this broad it mirrors the overhead light and the whole top flares white
  satin.clearcoat = 0;
  return satin;
}

/**
 * A domed plate: its top follows `topY(r)` (r = distance from the centre), its sides taper in underneath like a
 * cocktail ring's gallery. Built as rings of points from the centre to the outline, so the dome actually curves.
 */
function domedPlate(outline: THREE.Vector2[], topY: (r: number) => number, depth: number) {
  const N = outline.length, R = 10, pos: number[] = [], idx: number[] = [];
  const vert = (x: number, y: number, z: number) => { pos.push(x, y, z); return pos.length / 3 - 1; };
  const top: number[][] = [], bot: number[][] = [];
  for (let r = 0; r <= R; r++) {
    const t = r / R, row: number[] = [], brow: number[] = [];
    for (let i = 0; i < N; i++) {
      const p = outline[i], x = p.x * t, z = p.y * t, rr = Math.hypot(x, z);
      row.push(vert(x, topY(rr), z));
      brow.push(vert(x * 0.62, topY(rr) - depth, z * 0.62));
    }
    top.push(row); bot.push(brow);
  }
  for (let r = 0; r < R; r++) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    idx.push(top[r][i], top[r + 1][i], top[r + 1][j], top[r][i], top[r + 1][j], top[r][j]);
    idx.push(bot[r][i], bot[r + 1][j], bot[r + 1][i], bot[r][i], bot[r][j], bot[r + 1][j]);
  }
  for (let i = 0; i < N; i++) { // the tapering side
    const j = (i + 1) % N, a = top[R][i], b = top[R][j], c2 = bot[R][i], e = bot[R][j];
    idx.push(a, c2, e, a, e, b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** pavé ribbons sweeping round the centre stone into the shank (swirl / bypass rings) */
export function swirlArms(d: Design, m: Mats, c: CenterStone, gy: number, RIN: number) {
  const g = new THREE.Group();
  const R = Math.max(c.lengthMm, c.widthMm) / 2;
  const n = Math.max(1, Math.min(5, d.options.count));
  const w = Math.max(1.4, patternMaxW(d, 2.2) + 0.6);
  const bandPt = (a: number) => v3(Math.sin(a) * (RIN + 1.2), Math.cos(a) * (RIN + 1.2), 0);
  for (let k = 0; k < n; k++) {
    const side = k % 2 === 0 ? 1 : -1; // over the front or the back of the stone
    const r = R + 1.1 + w / 2 + Math.floor(k / 2) * (w + 0.3) + (k % 2) * 0.4;
    const lift = gy - 0.9 - k * 0.15;
    const sweep = 0.35 + k * 0.12; // how far round it wraps
    const pts = [bandPt(-0.95 - k * 0.06).add(v3(0, 0, -side * 0.6))];
    // a bypass: from the back on one side, over the front of the stone, to the other side — the next ribbon goes the other way
    for (let j = 0; j <= 12; j++) {
      const t = j / 12, a = Math.PI + sweep - t * (Math.PI + 2 * sweep);
      const z = side * (Math.sin(a) * r + (t - 0.5) * r * 0.9);
      pts.push(v3(Math.cos(a) * r, lift + Math.sin(t * Math.PI) * 0.5, z));
    }
    pts.push(bandPt(0.95 + k * 0.06).add(v3(0, 0, side * 0.6)));
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    const t = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, w / 2, 10, false), m.metal);
    t.scale.y = 1;
    g.add(t);
    g.add(patternRun(d, m, curve, 0.08, 0.92, { maxW: w - 0.5, gap: 0.12, offset: () => v3(0, w * 0.42, 0) }).group);
  }
  return g;
}

/** a posy of little gold flowers on a dome, optionally with a diamond in each centre */
/**
 * A posy of little gold flowers. With `around` (a centre stone's outline), the flowers frame the stone in a ring
 * instead of filling the middle, sitting just below its girdle and tilting gently outward.
 */
export function flowerCluster(d: Design, m: Mats, around?: CenterStone) {
  const g = new THREE.Group();
  const n = Math.max(1, Math.min(around ? 16 : 12, d.options.count));
  const petal = new THREE.SphereGeometry(1, 14, 10);
  const spots: { pos: THREE.Vector3; up: THREE.Vector3; r: number; petals: number }[] = [];
  let outer = 5.6;
  if (around) {
    const fn = outlineFn(around.shape, around.lengthMm, around.widthMm);
    const fr = Math.max(1.6, Math.min(3, (Math.max(around.lengthMm, around.widthMm) * Math.PI) / (n * 2.1)));
    for (let i = 0; i < n; i++) {
      const [x, z] = fn(i / n), r0 = Math.hypot(x, z) || 1;
      const k = (r0 + fr * 0.95 + 0.3) / r0;
      const out = v3(x / r0, 0, z / r0);
      spots.push({ pos: v3(x * k, -0.6 - (i % 2) * 0.25, z * k), up: v3(out.x * 0.45, 1, out.z * 0.45).normalize(), r: fr * (0.92 + ((i * 7) % 5) * 0.04), petals: 5 + (i % 3) });
      outer = Math.max(outer, r0 + fr * 2 + 0.3);
    }
  } else {
    spots.push({ pos: v3(0, 2.2, 0), up: Y.clone(), r: 2.6, petals: 8 });
    for (let i = 1; i < n; i++) {
      const a = (i / (n - 1)) * Math.PI * 2 + (i % 2) * 0.3, ring = 4.1 + (i % 2) * 0.6;
      const up = v3(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55).normalize();
      spots.push({ pos: v3(Math.cos(a) * ring, 1.1 - (i % 2) * 0.3, Math.sin(a) * ring), up, r: 1.9 + ((i * 7) % 5) * 0.15, petals: 5 + (i % 4) });
    }
  }
  const centres: Item[] = [];
  for (const s of spots) {
    const f = new THREE.Group();
    for (let k = 0; k < s.petals; k++) {
      const a = (k / s.petals) * Math.PI * 2;
      const p = new THREE.Mesh(petal, m.metal);
      p.scale.set(s.r * 0.36, s.r * 0.14, s.r * 0.58);
      p.position.set(Math.cos(a) * s.r * 0.55, 0.15, Math.sin(a) * s.r * 0.55);
      p.rotation.y = -a + Math.PI / 2; p.rotation.x = 0.25;
      f.add(p);
    }
    f.quaternion.setFromUnitVectors(Y, s.up);
    f.position.copy(s.pos);
    g.add(f);
    centres.push({ pos: s.pos.clone().addScaledVector(s.up, 0.45), dia: s.r * 0.42, up: s.up });
  }
  if (d.options.pave) g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, centres));
  else g.add(balls(m.metal, centres.map((c) => ({ ...c, dia: c.dia * 0.9 }))));
  if (around) {
    // a gold gallery under the ring of flowers
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(outer * 0.92, outer * 0.75, 1.2, 48), m.metal);
    plate.position.y = -1.6;
    g.add(plate);
  } else {
    const dome = new THREE.Mesh(new THREE.SphereGeometry(5.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.metal);
    dome.scale.y = 0.35;
    g.add(dome);
  }
  return g;
}

/** a ring of tiny stones round one stone (tennis bracelets with a halo on every stone) */
/**
 * A halo of small stones round one stone in a line (tennis bracelets and necklaces), following that stone's own
 * outline: a heart gets a heart-shaped halo, a pear a pear-shaped one. Stones are spaced evenly along the outline.
 */
export function haloRing(pos: THREE.Vector3, quat: THREE.Quaternion, W: number, L: number, out: Item[], shape: CenterStone["shape"] = "oval") {
  const hd = Math.max(0.55, W * 0.17), off = hd / 2 + 0.15;
  const fn = outlineFn(shape, L, W);
  // the outline pushed out by `off` along its outward normal, sampled finely
  const S = 360, pts: THREE.Vector2[] = [];
  const raw = Array.from({ length: S }, (_, i) => fn(i / S));
  const cx = raw.reduce((s, [x]) => s + x, 0) / S, cz = raw.reduce((s, [, z]) => s + z, 0) / S;
  for (let i = 0; i < S; i++) {
    const [x0, z0] = raw[(i + S - 1) % S], [x1, z1] = raw[(i + 1) % S], [x, z] = raw[i];
    let nx = z1 - z0, nz = -(x1 - x0);
    const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
    if (nx * (x - cx) + nz * (z - cz) < 0) { nx = -nx; nz = -nz; } // pointing outward
    pts.push(new THREE.Vector2(x + nx * off, z + nz * off));
  }
  const seg = pts.map((p, i) => p.distanceTo(pts[(i + 1) % S]));
  const per = seg.reduce((s, d) => s + d, 0);
  const n = Math.max(8, Math.round(per / (hd + 0.12)));
  let i = 0, acc = 0;
  for (let k = 0; k < n; k++) {
    const want = (k / n) * per;
    while (acc + seg[i] < want && i < S - 1) { acc += seg[i]; i++; }
    const p = pts[i].clone().lerp(pts[(i + 1) % S], seg[i] ? (want - acc) / seg[i] : 0);
    out.push({ pos: v3(p.x, -0.15, p.y).applyQuaternion(quat).add(pos), dia: hd, quat });
  }
}

/**
 * The half-flowered ring: at the end of the centre stone (along the finger), a little round stone with pear petals
 * fanned round its outer half, tips pointing in, so it reads as half a flower tucked against the stone.
 * `both` puts one at each end. Petals are the accent gem; their size follows the centre stone.
 */
export function halfFlower(d: Design, m: Mats, c: CenterStone, both = false, alongBand = false) {
  const g = new THREE.Group();
  g.userData.keep = true; // the flowers are the design: switching accent stones off leaves them
  // built along Z (the stone's length, along the finger); along the band it is built on the stone's width and turned 90°
  const reach = alongBand ? c.widthMm : c.lengthMm;
  if (alongBand) g.rotation.y = Math.PI / 2;
  const n = Math.max(3, Math.min(9, d.options.count));
  const dc = Math.max(1.6, Math.min(3.6, Math.min(c.lengthMm, c.widthMm) * 0.32)); // the flower's round centre
  const pw = dc * 0.95, pl = pw * ASPECT.pear;
  const rr = dc / 2 + pl / 2 + 0.12;
  const spread = (200 * Math.PI) / 180; // a little more than half, so the petals wrap the stone's corners
  for (const end of both ? [-1, 1] : [-1]) {
    const centre = v3(0, -0.2, end * (reach / 2 + dc / 2 + 0.25));
    const petals: Item[] = [];
    for (let i = 0; i < n; i++) {
      const phi = -spread / 2 + (spread * i) / (n - 1);
      const out = v3(Math.sin(phi), 0, end * Math.cos(phi));
      // pears point toward their own +Z: turn each to point back at the flower's centre, tilted up like a petal
      petals.push({ pos: centre.clone().addScaledVector(out, rr).add(v3(0, -0.35, 0)), dia: pw, up: v3(out.x * 0.3, 1, out.z * 0.3).normalize(), yaw: Math.atan2(-out.x, -out.z) });
    }
    g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, petals, "pear"));
    g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: centre, dia: dc }], "round"));
    // a gold gallery under the flower, joining it to the head
    g.add(tube(m, [centre.clone().add(v3(0, -1.2, 0)), v3(0, -1.6, end * (reach / 2 - 0.5))], 0.45));
  }
  return g;
}
