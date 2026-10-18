import * as THREE from "three";
import { type CenterStone, type Design, type Frame } from "../design";
import { outlineFn } from "../ringModel";
import { Y, v3 } from "./common";
import { type Mats } from "./materials";
import { ASPECT, type Item, accents, balls } from "./elements";
import { patternMaxW, patternRun } from "./patterns";
import { tube } from "./stones";
import { handPolished } from "../polish";

export function decoFrames(d: Design, m: Mats, c: CenterStone, y0 = -0.15, pass = 0, finger?: { r: number; gy: number }): { group: THREE.Group; extent: number } {
  const g = new THREE.Group();
  g.userData.part = "accents";
  g.userData.keep = true;
  const N = 180;
  const theta = (x: number, z: number) => (Math.atan2(z, x) + Math.PI * 2) % (Math.PI * 2);
  const prev = new Float32Array(N);
  const turn = THREE.MathUtils.degToRad(c.rotation ?? 0), ct = Math.cos(turn), st0 = Math.sin(turn);
  const turned = ([x, z]: [number, number]): [number, number] => (turn ? [x * ct + z * st0, -x * st0 + z * ct] : [x, z]);
  { const fn = outlineFn(c.shape, c.lengthMm + 0.5, c.widthMm + 0.5); for (let k = 0; k < 720; k++) { const [x, z] = turned(fn(k / 720)); const b = Math.floor((theta(x, z) / (Math.PI * 2)) * N) % N; prev[b] = Math.max(prev[b], Math.hypot(x, z)); } }
  for (let b = 0; b < N; b++) if (!prev[b]) prev[b] = prev[(b + N - 1) % N];
  const prevAt = (a: number) => prev[Math.floor((a / (Math.PI * 2)) * N) % N];
  const centreHalf = Math.max(c.lengthMm, c.widthMm) / 2 + 0.5;
  const maxHalf = Math.max(centreHalf + 4, d.type === "ring" ? 16 : 12);
  const growth = d.frames.reduce((a, f) => a + f.gapMm + (f.kind === "stones" ? (f.direction === "radial" ? f.widthMm * ASPECT[f.shape] : f.widthMm) : f.kind === "milgrain" ? 0.55 : f.kind === "fill" ? f.widthMm * ASPECT[f.shape] : f.widthMm), 0);
  const pointed = d.frames.some((f) => f.fit === "point");
  const fit = !pointed && centreHalf + growth > maxHalf ? Math.max(0.05, (maxHalf - centreHalf) / growth) : 1;
  const frames = fit < 1 ? d.frames.map((f) => ({ ...f, widthMm: Math.max(0.6, f.widthMm * fit), gapMm: f.gapMm * fit })) : d.frames;
  const dome = d.options.decoDome;
  const Rd = dome > 0 ? 70 - 54 * dome : 0;
  const r0 = centreHalf - 0.5;
  const domeY = (r: number) => y0 - Math.max(0, r * r - r0 * r0) / (2 * Rd);
  const tilt = (p: THREE.Vector3) => v3(p.x / Rd, 1, p.z / Rd).normalize();
  const bin = (a: number) => Math.floor((a / (Math.PI * 2)) * N) % N;
  let y = y0, outer: THREE.Vector3[] = [];
  let sideStone: SideStone | null = null;
  frames.forEach((f0, fi) => {
    const before = frames[fi - 1];
    const f = f0.ratio == null && before && before.outline === f0.outline && before.ratio != null ? { ...f0, ratio: before.ratio } : f0;
    const stoneL = f.widthMm * ASPECT[f.shape];
    const thick = f.kind === "stones" ? (f.direction === "radial" ? stoneL : f.widthMm) : f.kind === "milgrain" ? 0.55 : f.widthMm;
    const unit = f.ratio != null ? outlineFn(f.outline, (c.widthMm + 1) * f.ratio, c.widthMm + 1) : outlineFn(f.outline, c.lengthMm + 1, c.widthMm + 1);
    const followsStone = f.outline === c.shape && f.ratio == null;
    const S = 240, raw = Array.from({ length: S }, (_, k) => (followsStone ? turned(unit(k / S)) : unit(k / S)));
    if (f.kind === "fill") {
      const sz = f.widthMm, radial = f.direction === "radial";
      const slotAlong = (radial ? sz : sz * ASPECT[f.shape]) + 0.05, slotAcross = (radial ? sz * ASPECT[f.shape] : sz) + 0.05;
      let seed = 17;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let k2 = 0;
      for (const [x, z] of raw) k2 = Math.max(k2, (prevAt(theta(x, z)) + f.gapMm + slotAcross) / (Math.hypot(x, z) || 1));
      const ringPts = raw.map(([x, z]) => v3(x * k2, 0, z * k2));
      const outerR = new Float32Array(N);
      for (const p of ringPts) { const b = bin(theta(p.x, p.z)); outerR[b] = Math.max(outerR[b], Math.hypot(p.x, p.z)); }
      for (let b = 0; b < N; b++) if (!outerR[b]) outerR[b] = outerR[(b + N - 1) % N] || outerR[(b + 1) % N];
      const outerAt = (a: number) => outerR[bin(a)];
      const groups = new Map<string, Item[]>();
      const put = (key: string, it: Item) => (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
      const A = 1440;
      let n = 0;
      for (let row = 0; row < 60; row++) {
        let any = false, acc = slotAlong / 2 + (row % 2) * slotAlong / 2, last: THREE.Vector3 | null = null, k = 0;
        const rowsAt = (th: number) => Math.max(1, Math.round((outerAt(th) - prevAt(th) - f.gapMm) / slotAcross));
        const rAt = (th: number) => { const inner = prevAt(th) + f.gapMm; return inner + ((row + 0.5) * (outerAt(th) - inner)) / rowsAt(th); };
        for (let a = 0; a < A; a++) {
          const th = (a / A) * Math.PI * 2, r = rAt(th);
          if (row >= rowsAt(th)) { last = null; continue; }
          any = true;
          const p = v3(Math.cos(th) * r, 0, Math.sin(th) * r);
          if (last) acc += p.distanceTo(last);
          last = p;
          if (acc < slotAlong) continue;
          acc = 0;
          const th2 = th + (Math.PI * 2) / A, r2 = rAt(th2);
          const tan = v3(Math.cos(th2) * r2 - p.x, 0, Math.sin(th2) * r2 - p.z).normalize();
          p.y = dome > 0 ? domeY(r) : y;
          const up = dome > 0 ? tilt(p) : Y.clone();
          const isAlt = !!f.alt && (f.pattern === "vines" ? (((k - row) % (f.every + 1)) + (f.every + 1)) % (f.every + 1) === 0 : n % (f.every + 1) === f.every);
          k++;
          const shape = isAlt ? f.alt!.shape : f.shape;
          const out = v3(p.x, 0, p.z).normalize();
          const diag = v3(Math.sign(p.x || 1), 0, Math.sign(p.z || 1)).normalize();
          const facing = isAlt ? (f.pattern === "vines" ? diag : tan) : radial ? out : tan;
          const dir = facing.clone().addScaledVector(up, -facing.dot(up)).normalize();
          const X = new THREE.Vector3().crossVectors(up, dir).normalize();
          const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, up, dir));
          if (isAlt && f.pattern !== "vines") quat.multiply(new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(n % 2 ? 35 : -35)));
          else if (!isAlt && f.cut === "cabochon") quat.multiply(new THREE.Quaternion().setFromAxisAngle(Y, (rnd() * 2 - 1) * 0.45));
          const rowGap = (outerAt(th) - prevAt(th) - f.gapMm) / rowsAt(th);
          const room = radial ? Math.min(slotAlong - 0.06, (rowGap - 0.06) / ASPECT[f.shape]) : Math.min(rowGap - 0.06, (slotAlong - 0.06) / ASPECT[f.shape]);
          const fitted = Math.min(sz * 1.8, Math.max(sz * 0.9, room + 0.3));
          const jitter = 1 + (rnd() * 2 - 1) * Math.max(f.vary, f.cut === "cabochon" ? 0.12 : 0);
          const leaf = (Math.max(slotAlong, rowGap) * (f.pattern === "vines" ? 1.3 : 1)) / ASPECT[shape];
          const dia = (isAlt ? Math.max(Math.min(fitted, leaf), f.pattern === "vines" ? leaf : 0) : fitted) * jitter;
          const look = isAlt ? f.alt! : f;
          put(`${look.gem}|${look.color}|${look.cut}|${shape}`, { pos: isAlt ? p.clone().addScaledVector(up, 0.25) : p, dia, quat, up });
          n++;
        }
        if (!any) break;
      }
      groups.forEach((items, key) => {
        const [gem, color, cut, shape] = key.split("|");
        g.add(accents(m, gem as Frame["gem"], color, cut as Frame["cut"], items, shape as Frame["shape"], 0.27));
      });
      sideStone = { gem: f.gem, color: f.color, cut: f.cut, shape: f.shape, size: sz, alt: f.alt, every: f.every };
      outer = ringPts.map((p) => v3(p.x, y, p.z));
      for (let b = 0; b < N; b++) prev[b] = Math.max(prev[b], outerR[b]);
      if (!(dome > 0)) y -= 0.12;
      return;
    }
    let kScale = 0;
    for (const [x, z] of raw) kScale = Math.max(kScale, (prevAt(theta(x, z)) + f.gapMm) / (Math.hypot(x, z) || 1));
    const hug = f.fit === "hug" || f.fit === "point";
    const hugRing = (dist: number) => {
      const pts = Array.from({ length: N }, (_, b) => { const a = ((b + 0.5) / N) * Math.PI * 2; return [Math.cos(a) * prev[b], Math.sin(a) * prev[b]] as const; });
      const off = pts.map((p, i) => {
        const a = pts[(i + N - 1) % N], c2 = pts[(i + 1) % N];
        let nx = c2[1] - a[1], nz = -(c2[0] - a[0]);
        const l = Math.hypot(nx, nz) || 1; nx /= l; nz /= l;
        if (nx * p[0] + nz * p[1] < 0) { nx = -nx; nz = -nz; }
        return v3(p[0] + nx * dist, y, p[1] + nz * dist);
      });
      if (f.fit !== "point") return off;
      const rad = new Float32Array(N);
      for (const q of off) { const b = Math.floor((theta(q.x, q.z) / (Math.PI * 2)) * N) % N; rad[b] = Math.max(rad[b], Math.hypot(q.x, q.z)); }
      for (let b = 0; b < N; b++) if (!rad[b]) rad[b] = Math.max(rad[(b + N - 1) % N], rad[(b + 1) % N]);
      return Array.from({ length: N }, (_, b) => {
        const a = ((b + 0.5) / N) * Math.PI * 2;
        const tip = Math.pow(Math.abs(Math.sin(a - turn)), 6);
        const r = Math.max(rad[b], prev[b] + dist * (1 + 0.45 * tip));
        return v3(Math.cos(a) * r, y, Math.sin(a) * r);
      });
    };
    const meanR = hug ? prev.reduce((a, r) => a + r, 0) / N + f.gapMm : raw.reduce((a, [x, z]) => a + Math.hypot(x, z), 0) / S * kScale;
    if (dome > 0) y = domeY(meanR + thick / 2);
    const ring = (extra: number) => hug ? hugRing(f.gapMm + extra) : raw.map(([x, z]) => { const r = Math.hypot(x, z) || 1, rr = r * kScale + extra; return v3((x / r) * rr, y, (z / r) * rr); });
    const centre = new THREE.CatmullRomCurve3(ring(thick / 2), true, "centripetal");
    if (f.kind === "stones") {
      sideStone = { gem: f.gem, color: f.color, cut: f.cut, shape: f.shape, size: f.widthMm, alt: f.alt, every: f.every };
      const pd: Design = { ...d, accents: { ...d.accents, gem: f.gem, color: f.color, cut: (f.cut === "polki" || f.cut === "rose-cut" || f.cut === "briolette" || f.cut === "bead" ? f.cut : "faceted") as Design["accents"]["cut"], sizeCt: 6, shapes: [f.shape], orientation: f.direction === "radial" ? "across" : "along", turns: [], twins: [], colors: [] } };
      const main = { gem: f.gem, color: f.color, cut: f.cut, shape: f.shape };
      const alt = f.alt ? { gem: f.alt.gem, color: f.alt.color, cut: f.alt.cut, shape: f.alt.shape } : null;
      const spokes = Math.max(5, 12 - 2 * f.every), shift = fi * 0.42;
      const vineAt = (pos: THREE.Vector3, count: number) => {
        const phase = (theta(pos.x, pos.z) / (Math.PI * 2)) * spokes + shift, j = Math.round(phase);
        return Math.abs(phase - j) * (count / spokes) < 0.5 ? { ...alt!, turn: (((j % 2) + 2) % 2 ? 40 : -40), scale: 1.15 } : null;
      };
      const gemAt = (i: number, pos: THREE.Vector3, count: number) => (!alt ? main : f.pattern === "vines" ? vineAt(pos, count) ?? main : i % (f.every + 1) === f.every ? alt : main);
      const organic = f.cut === "cabochon" && (f.pattern === "vines" || f.vary > 0);
      g.add(patternRun(pd, m, centre, 0, 1, { editKey: `frame${fi}`, closed: true, gap: 0.14, maxW: thick, gemAt, ...(organic ? { dome: 0.27, vary: Math.max(f.vary, 0.15) } : f.vary ? { vary: f.vary } : {}), ...(dome > 0 ? { up: (u: number) => tilt(centre.getPointAt(u)) } : {}) }).group);
    } else if (f.kind === "milgrain") {
      const n = Math.max(12, Math.round(centre.getLength() / 0.5));
      g.add(balls(m.satin, Array.from({ length: n }, (_, k) => ({ pos: centre.getPointAt(k / n).add(v3(0, 0.12, 0)), dia: 0.42 }))));
    } else {
      const band = new THREE.Mesh(new THREE.TubeGeometry(centre, 240, thick / 2, 8, true), m.metal);
      band.scale.y = 0.6; band.position.y = (1 - 0.6) * y;
      g.add(band);
    }
    outer = ring(thick);
    for (const p of outer) { const a = theta(p.x, p.z), b = Math.floor((a / (Math.PI * 2)) * N) % N; prev[b] = Math.max(prev[b], Math.hypot(p.x, p.z)); }
    for (let b = 0; b < N; b++) prev[b] = Math.max(prev[b], Math.min(prev[(b + 1) % N], prev[(b + N - 1) % N]));
    if (!(dome > 0)) y -= 0.12;
  });
  const wrap = d.options.decoWrap && !!sideStone;
  if (outer.length && (dome > 0 || wrap)) {
    const rim = outer.map((p) => new THREE.Vector2(p.x, p.z));
    const flatY = y;
    const topY = dome > 0 ? (r: number) => domeY(r) - 0.75 : () => flatY - 0.75;
    const full = wrap ? 1.6 + Math.min(3.4 * sideStone!.size, 5) : 1.6, bend = d.type === "ring" ? d.options.decoBend : 0;
    const shaped = (p: THREE.Vector2) => { const across = (p.x * p.x) / Math.max(1e-6, p.x * p.x + p.y * p.y); return bend > 0 ? Math.max(1.2, full * (1 - 0.85 * bend * across)) : full; };
    const clear = (p: THREE.Vector2) => {
      if (!finger) return Infinity;
      const x = Math.abs(p.x) * (1 - ROUNDING);
      if (x >= finger.r) return Infinity;
      return topY(Math.hypot(p.x, p.y)) + finger.gy - Math.sqrt(finger.r * finger.r - x * x);
    };
    const depth: Depth = bend > 0 || finger ? (p) => Math.max(0.8, Math.min(shaped(p), clear(p))) : full;
    const plate = new THREE.Mesh(domedPlate(rim, topY, depth, finger), plateMetal(m));
    plate.userData.part = "metal";
    g.add(plate);
    if (wrap) g.add(wrapStones(m, rim, topY, depth, sideStone!));
  } else if (outer.length) {
    const shape = new THREE.Shape(outer.map((p) => new THREE.Vector2(p.x, p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.3, bevelSize: 0.25, bevelSegments: 3, curveSegments: 8 });
    geo.rotateX(Math.PI / 2); geo.translate(0, y - 0.75, 0);
    geo.computeBoundingBox();
    const { min, max } = geo.boundingBox!;
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - min.y) / Math.max(1e-6, max.y - min.y);
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
  if (extent > maxHalf * 1.12 && pass < 3 && !pointed && !frames.some((f) => f.kind === "fill")) {
    const k = Math.max(0.2, (maxHalf - centreHalf) / Math.max(0.1, extent - centreHalf));
    return decoFrames({ ...d, frames: frames.map((f) => ({ ...f, widthMm: Math.max(0.6, f.widthMm * k), gapMm: f.gapMm * k })) }, m, c, y0, pass + 1, finger);
  }
  return { group: g, extent };
}

function plateMetal(m: Mats) {
  const satin = handPolished((m.metal as THREE.MeshPhysicalMaterial).clone());
  satin.side = THREE.DoubleSide;
  satin.roughness = 0.62;
  satin.envMapIntensity = 0.3;
  satin.color = satin.color.clone().multiplyScalar(0.72);
  satin.clearcoat = 0;
  return satin;
}

type SideStone = { gem: Frame["gem"]; color: string; cut: Frame["cut"]; shape: Frame["shape"]; size: number; alt: Frame["alt"]; every: number };

function wrapStones(m: Mats, rim: THREE.Vector2[], topY: (r: number) => number, depth: Depth, st: SideStone) {
  const g = new THREE.Group();
  const pitch = st.size + 0.04;
  const N = rim.length;
  const arcAt = (p: THREE.Vector2) => { let a = 0, last = wallPoint(p, topY, depth, 0); for (let k = 1; k <= 12; k++) { const q = wallPoint(p, topY, depth, (k / 12) * (Math.PI / 2)); a += q.distanceTo(last); last = q; } return a; };
  const rows = rim.map((p) => Math.max(0, Math.round(arcAt(p) / pitch - 0.15)));
  const maxRows = Math.max(0, ...rows);
  const groups = new Map<string, Item[]>();
  const put = (key: string, it: Item) => (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
  let n = 0;
  for (let row = 0; row < maxRows; row++) {
    const phiAt = (i: number) => (Math.min(row, rows[i % N] - 1) + 0.55) / Math.max(1, rows[i % N]) * (Math.PI / 2);
    let acc = (row % 2) * pitch / 2;
    let prevP = wallPoint(rim[0], topY, depth, phiAt(0));
    for (let i = 1; i <= N; i++) {
      const a = rim[i % N], phi = phiAt(i), p = wallPoint(a, topY, depth, phi);
      acc += p.distanceTo(prevP); prevP = p;
      if (row >= rows[i % N] || acc < pitch) continue;
      acc = 0;
      const around = wallPoint(rim[(i + 1) % N], topY, depth, phiAt(i + 1)).sub(p).normalize();
      const down = wallPoint(a, topY, depth, Math.min(Math.PI / 2, phi + 0.05)).sub(p).normalize();
      const up = new THREE.Vector3().crossVectors(down, around).normalize();
      if (up.dot(v3(p.x, 0, p.z)) < 0) up.negate();
      const isAlt = !!st.alt && n % (st.every + 1) === st.every;
      const shape = isAlt ? st.alt!.shape : st.shape;
      const dir = around.clone().addScaledVector(up, -around.dot(up)).normalize();
      const X = new THREE.Vector3().crossVectors(up, dir).normalize();
      const quat = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, up, dir));
      if (isAlt) quat.multiply(new THREE.Quaternion().setFromAxisAngle(Y, THREE.MathUtils.degToRad(n % 2 ? 35 : -35)));
      const look = isAlt ? st.alt! : st;
      put(`${look.gem}|${look.color}|${look.cut}|${shape}`, { pos: p.clone().addScaledVector(up, 0.35), dia: isAlt ? Math.min(st.size, pitch / ASPECT[shape] * 1.6) : st.size, quat, up });
      n++;
    }
  }
  groups.forEach((items, key) => {
    const [gem, color, cut, shape] = key.split("|");
    g.add(accents(m, gem as Frame["gem"], color, cut as Frame["cut"], items, shape as Frame["shape"], 0.27));
  });
  return g;
}

export const ROUNDING = 0.32;

export type Depth = number | ((p: THREE.Vector2) => number);
const depthAt = (depth: Depth, p: THREE.Vector2) => (typeof depth === "number" ? depth : depth(p));

export function wallPoint(p: THREE.Vector2, topY: (r: number) => number, depth: Depth, phi: number) {
  const rr = Math.hypot(p.x, p.y), k = 1 - ROUNDING + ROUNDING * Math.cos(phi);
  return v3(p.x * k, topY(rr) - depthAt(depth, p) * Math.sin(phi), p.y * k);
}

function domedPlate(outline: THREE.Vector2[], topY: (r: number) => number, depth: Depth, finger?: { r: number; gy: number }) {
  const N = outline.length, R = 10, E = 10, pos: number[] = [], idx: number[] = [];
  const vert = (v: THREE.Vector3) => { pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; };
  const rows: number[][] = [];
  for (let r = 0; r <= R; r++) {
    const t = r / R;
    rows.push(outline.map((p) => { const x = p.x * t, z = p.y * t; return vert(v3(x, topY(Math.hypot(x, z)), z)); }));
  }
  for (let e = 1; e <= E; e++) rows.push(outline.map((p) => vert(wallPoint(p, topY, depth, (e / E) * (Math.PI / 2)))));
  const k = 1 - ROUNDING, bottom: number[][] = [];
  for (let r = R; r >= 0; r--) {
    const t = r / R;
    bottom.push(outline.map((p) => {
      const x = p.x * k * t, z = p.y * k * t;
      let y = topY(Math.hypot(p.x, p.y)) - depthAt(depth, p);
      if (finger && Math.abs(x) < finger.r) y = Math.max(y, Math.sqrt(finger.r * finger.r - x * x) - finger.gy);
      return vert(v3(x, Math.min(y, topY(Math.hypot(x, z)) - 0.4), z));
    }));
  }
  const all = [...rows, ...bottom.slice(1)];
  for (let r = 0; r < all.length - 1; r++) for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    idx.push(all[r][i], all[r + 1][i], all[r + 1][j], all[r][i], all[r + 1][j], all[r][j]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function swirlArms(d: Design, m: Mats, c: CenterStone, gy: number, RIN: number) {
  const g = new THREE.Group();
  const R = Math.max(c.lengthMm, c.widthMm) / 2;
  const n = Math.max(1, Math.min(5, d.options.count));
  const w = Math.max(1.4, patternMaxW(d, 2.2) + 0.6);
  const bandPt = (a: number) => v3(Math.sin(a) * (RIN + 1.2), Math.cos(a) * (RIN + 1.2), 0);
  for (let k = 0; k < n; k++) {
    const side = k % 2 === 0 ? 1 : -1;
    const r = R + 1.1 + w / 2 + Math.floor(k / 2) * (w + 0.3) + (k % 2) * 0.4;
    const lift = gy - 0.9 - k * 0.15;
    const sweep = 0.35 + k * 0.12;
    const pts = [bandPt(-0.95 - k * 0.06).add(v3(0, 0, -side * 0.6))];
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

export function haloRing(pos: THREE.Vector3, quat: THREE.Quaternion, W: number, L: number, out: Item[], shape: CenterStone["shape"] = "oval") {
  const hd = Math.max(0.55, W * 0.17), off = hd / 2 + 0.15;
  const fn = outlineFn(shape, L, W);
  const S = 360, pts: THREE.Vector2[] = [];
  const raw = Array.from({ length: S }, (_, i) => fn(i / S));
  const cx = raw.reduce((s, [x]) => s + x, 0) / S, cz = raw.reduce((s, [, z]) => s + z, 0) / S;
  for (let i = 0; i < S; i++) {
    const [x0, z0] = raw[(i + S - 1) % S], [x1, z1] = raw[(i + 1) % S], [x, z] = raw[i];
    let nx = z1 - z0, nz = -(x1 - x0);
    const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
    if (nx * (x - cx) + nz * (z - cz) < 0) { nx = -nx; nz = -nz; }
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

export function halfFlower(d: Design, m: Mats, c: CenterStone, both = false, alongBand = false) {
  const g = new THREE.Group();
  g.userData.keep = true;
  const reach = alongBand ? c.widthMm : c.lengthMm;
  if (alongBand) g.rotation.y = Math.PI / 2;
  const n = Math.max(3, Math.min(9, d.options.count));
  const dc = Math.max(1.6, Math.min(3.6, Math.min(c.lengthMm, c.widthMm) * 0.32));
  const pw = dc * 0.95, pl = pw * ASPECT.pear;
  const rr = dc / 2 + pl / 2 + 0.12;
  const spread = (200 * Math.PI) / 180;
  for (const end of both ? [-1, 1] : [-1]) {
    const centre = v3(0, -0.2, end * (reach / 2 + dc / 2 + 0.25));
    const petals: Item[] = [];
    for (let i = 0; i < n; i++) {
      const phi = -spread / 2 + (spread * i) / (n - 1);
      const out = v3(Math.sin(phi), 0, end * Math.cos(phi));
      petals.push({ pos: centre.clone().addScaledVector(out, rr).add(v3(0, -0.35, 0)), dia: pw, up: v3(out.x * 0.3, 1, out.z * 0.3).normalize(), yaw: Math.atan2(-out.x, -out.z) });
    }
    g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, petals, "pear"));
    g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: centre, dia: dc }], "round"));
    g.add(tube(m, [centre.clone().add(v3(0, -1.2, 0)), v3(0, -1.6, end * (reach / 2 - 0.5))], 0.45));
  }
  return g;
}
