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
  const bin = (a: number) => Math.floor((a / (Math.PI * 2)) * N) % N;
  const prevAt = (a: number) => prev[bin(a)];
  // The bezel's own edge, before any layers: a sprays mosaic runs right up to it.
  const bezelEdge = Float32Array.from(prev);
  const bezelAt = (a: number) => bezelEdge[bin(a)] + 0.45;
  const centreHalf = Math.max(c.lengthMm, c.widthMm) / 2 + 0.5;
  const maxHalf = Math.max(centreHalf + 4, d.type === "ring" ? 16 : 12);
  const growth = d.frames.reduce((a, f) => a + f.gapMm + (f.kind === "stones" ? (f.direction === "radial" ? f.widthMm * ASPECT[f.shape] : f.widthMm) : f.kind === "milgrain" ? 0.55 : f.kind === "fill" ? f.widthMm * ASPECT[f.shape] : f.widthMm), 0);
  const pointed = d.frames.some((f) => f.fit === "point");
  const fit = !pointed && centreHalf + growth > maxHalf ? Math.max(0.05, (maxHalf - centreHalf) / growth) : 1;
  const frames = fit < 1 ? d.frames.map((f) => ({ ...f, widthMm: Math.max(0.6, f.widthMm * fit), gapMm: f.gapMm * fit })) : d.frames;
  const dome = d.options.decoDome;
  // A dome covered in a sprays mosaic is a true bombé: steeper, rolling over at its edges into walls that drop straight
  // down to the shoulders, rather than a flat cap that tucks in underneath.
  const bombe = dome > 0 && d.options.decoWrap && d.frames.some((f) => f.kind === "fill" && f.pattern === "sprays");
  const Rd = dome > 0 ? (bombe ? Math.min(70 - 54 * dome, 13) : 70 - 54 * dome) : 0;
  rounding = bombe ? 0.05 : ROUNDING;
  const r0 = centreHalf - 0.5;
  const domeY = (r: number) => y0 - Math.max(0, r * r - r0 * r0) / (2 * Rd);
  const tilt = (p: THREE.Vector3) => v3(p.x / Rd, 1, p.z / Rd).normalize();
  let y = y0, outer: THREE.Vector3[] = [];
  let sideStone: SideStone | null = null;
  frames.forEach((f0, fi) => {
    const before = frames[fi - 1];
    const f = f0.ratio == null && before && before.outline === f0.outline && before.ratio != null ? { ...f0, ratio: before.ratio } : f0;
    const stoneL = f.widthMm * ASPECT[f.shape];
    const thick = f.kind === "stones" ? (f.direction === "radial" ? stoneL : f.widthMm) : f.kind === "milgrain" ? 0.55 : f.widthMm;
    const unit = f.ratio != null ? outlineFn(f.outline, (c.widthMm + 1) * f.ratio, c.widthMm + 1) : outlineFn(f.outline, c.lengthMm + 1, c.widthMm + 1);
    const followsStone = f.outline === c.shape && f.ratio == null;
    const tc = Math.cos(THREE.MathUtils.degToRad(f.turn ?? 0)), ts = Math.sin(THREE.MathUtils.degToRad(f.turn ?? 0));
    const spin = ([x, z]: readonly [number, number] | number[]) => [x * tc - z * ts, x * ts + z * tc] as [number, number];
    const S = 240, raw = Array.from({ length: S }, (_, k) => spin(followsStone ? turned(unit(k / S)) : unit(k / S)));
    if (f.kind === "fill") {
      const sz = f.widthMm, radial = f.direction === "radial";
      const slotAlong = (radial ? sz : sz * ASPECT[f.shape]) + 0.05, slotAcross = (radial ? sz * ASPECT[f.shape] : sz) + 0.05;
      let seed = 17;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      let k2 = 0;
      for (const [x, z] of raw) k2 = Math.max(k2, (prevAt(theta(x, z)) + f.gapMm + slotAcross) / (Math.hypot(x, z) || 1));
      // The outermost fill of a ring with a measured top reaches out to that size, packed with stones, rather than
      // being one row wide and stretched (which leaves gold showing between the stones).
      const o = d.options;
      if (d.type === "ring" && fi === frames.length - 1 && (o.decoLengthMm > 0 || o.decoWidthMm > 0)) {
        const t = THREE.MathUtils.degToRad(c.rotation), al = v3(Math.sin(t), 0, Math.cos(t)), ac = v3(Math.cos(t), 0, -Math.sin(t));
        let ext = 0, exw = 0;
        for (const [x, z] of raw) { ext = Math.max(ext, Math.abs(x * al.x + z * al.z)); exw = Math.max(exw, Math.abs(x * ac.x + z * ac.z)); }
        const ks = [o.decoLengthMm > 0 ? (o.decoLengthMm / 2 - sz * 0.45) / ext : Infinity, o.decoWidthMm > 0 ? (o.decoWidthMm / 2 - sz * 0.45) / exw : Infinity].filter(Number.isFinite);
        if (ks.length) k2 = Math.max(k2, Math.min(...ks));
      }
      const ringPts = raw.map(([x, z]) => v3(x * k2, 0, z * k2));
      const outerR = new Float32Array(N);
      for (const p of ringPts) { const b = bin(theta(p.x, p.z)); outerR[b] = Math.max(outerR[b], Math.hypot(p.x, p.z)); }
      for (let b = 0; b < N; b++) if (!outerR[b]) outerR[b] = outerR[(b + N - 1) % N] || outerR[(b + 1) % N];
      const outerAt = (a: number) => outerR[bin(a)];
      const groups = new Map<string, Item[]>();
      const put = (key: string, it: Item) => (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
      // Sprays: leaves in pairs along milgrain stems from the centre out to the edge; the fill stones go everywhere else.
      const sprays = f.pattern === "sprays" && !!f.alt;
      // With only milgrain between it and the bezel, the mosaic starts at the bezel (the beading sits among its stones).
      const innerAt = sprays && frames.slice(0, fi).every((q) => q.kind === "milgrain") ? bezelAt : (a: number) => prevAt(a) + f.gapMm;
      const blocks: { x: number; z: number; r: number }[] = [];
      let sprayInfo: Sprays | null = null;
      if (sprays) {
        // Leaves are sized to the room between the centre and the edge, as a setter would cut them.
        const stems = 8, base = THREE.MathUtils.degToRad(f.turn ?? 0) + Math.PI / stems;
        const room = Array.from({ length: stems }, (_, j) => { const a = (j / stems) * Math.PI * 2 + base; return outerAt(a) - innerAt(a) - 0.3; }).sort((p, q) => p - q);
        const leafShape = f.alt!.shape, leafL = Math.min(Math.max(1.8, sz * 1.5), Math.max(1.8, room[Math.floor(stems / 2)] * 0.6)), leafW = leafL / ASPECT[leafShape];
        sprayInfo = { stems, base, leafL, leafW };
        const lookKey = `${f.alt!.gem}|${f.alt!.color}|${f.alt!.cut}|${leafShape}`;
        const stemDots: Item[] = [];
        const surface = (x: number, z: number) => v3(x, dome > 0 ? domeY(Math.hypot(x, z)) : y, z);
        const leafAt = (x: number, z: number, along: THREE.Vector3, bend: number) => {
          const p = surface(x, z), up = dome > 0 ? tilt(p) : Y.clone();
          const facing = along.clone().applyAxisAngle(Y, bend);
          const dir = facing.addScaledVector(up, -facing.dot(up)).normalize();
          const X = new THREE.Vector3().crossVectors(up, dir).normalize();
          put(lookKey, { pos: p.addScaledVector(up, 0.2), dia: leafW, quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, up, dir)), up });
          // A leaf is long and narrow: it blocks three small circles along its length, not one big one.
          for (const k of [-0.3, 0, 0.3]) blocks.push({ x: x + dir.x * leafL * k, z: z + dir.z * leafL * k, r: leafW * (k ? 0.34 : 0.48) });
        };
        for (let j = 0; j < stems; j++) {
          const a = (j / stems) * Math.PI * 2 + base;
          const r0s = innerAt(a) + 0.05, r1s = outerAt(a) - leafL * 0.35, len = r1s - r0s;
          if (len < leafL * 0.7) continue;
          const sway = (j % 2 ? 1 : -1) * 0.12 * len;
          const at = (t: number) => {
            const r = r0s + t * len, side = sway * Math.sin(Math.PI * t);
            return { x: Math.cos(a) * r - Math.sin(a) * side, z: Math.sin(a) * r + Math.cos(a) * side };
          };
          for (let t = 0; t <= 1.0001; t += 0.4 / len) { const q = at(t); const p = surface(q.x, q.z); stemDots.push({ pos: p.add(v3(0, 0.1, 0)), dia: 0.34 }); blocks.push({ x: q.x, z: q.z, r: 0.17 }); }
          const step = leafL * 0.8;
          for (let s0 = Math.min(leafL * 0.38, len * 0.3); s0 < Math.max(len - leafL * 0.3, len * 0.45); s0 += step) {
            const t = s0 / len, q = at(t), q2 = at(Math.min(1, t + 0.02));
            const along = v3(q2.x - q.x, 0, q2.z - q.z).normalize(), side = v3(-along.z, 0, along.x);
            for (const sgn of [-1, 1]) leafAt(q.x + side.x * sgn * leafW * 0.75 + along.x * leafL * 0.1, q.z + side.z * sgn * leafW * 0.75 + along.z * leafL * 0.1, along, sgn * 0.62);
          }
          const tip = at(1), before = at(0.97);
          leafAt(tip.x, tip.z, v3(tip.x - before.x, 0, tip.z - before.z).normalize(), 0);
        }
        g.add(balls(m.satin, stemDots));
      }
      const blocked = (x: number, z: number, r: number) => blocks.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r);
      let wallStone: { shape: Frame["shape"]; size: number } | null = null;
      if (sprays) {
        const room = Array.from({ length: 16 }, (_, j) => { const a = (j / 16) * Math.PI * 2; return outerAt(a) - innerAt(a); }).sort((p, q) => p - q)[8];
        const cell = Math.min(sz, Math.max(1.1, Math.min(room / 2.3, 1.55)));
        const reach = Math.max(...Array.from({ length: 64 }, (_, j) => outerAt((j / 64) * Math.PI * 2)));
        // Mosaic stones are cut close to square to fill their cells (sugarloaf), so an oval or long shape packs as a cushion.
        const fillShape = ASPECT[f.shape] > 1.1 ? "cushion" : f.shape;
        // The same packed stones carry on down the dome's walls, several rows deep.
        wallStone = { shape: fillShape, size: Math.min(cell * 0.9, 1.35) };
        const key = `${f.gem}|${f.color}|${f.cut}|${fillShape}`;
        // Candidate spots on a fine grid, in random order, for the stones that fill the gaps after the honeycomb.
        const step = cell / 4, cands: [number, number][] = [];
        for (let x = -reach; x <= reach; x += step) for (let z = -reach; z <= reach; z += step) cands.push([x, z]);
        for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
        const got: { x: number; z: number }[] = [], bucket = new Map<string, number[]>();
        const cellKey = (x: number, z: number) => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
        const near = (x: number, z: number, d: number) => {
          const cx = Math.floor(x / cell), cz = Math.floor(z / cell);
          for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) for (const k of bucket.get(`${cx + i},${cz + j}`) ?? []) if (Math.hypot(got[k].x - x, got[k].z - z) < d) return true;
          return false;
        };
        const inside = (x: number, z: number, m: number) => { const r = Math.hypot(x, z), th = theta(x, z); return r >= innerAt(th) + cell * m && r <= outerAt(th) - cell * (bombe ? 0.02 : 0.28); };
        const take = (x: number, z: number) => { (bucket.get(cellKey(x, z)) ?? bucket.set(cellKey(x, z), []).get(cellKey(x, z))!).push(got.length); got.push({ x, z }); };
        // Every free spot between the leaves is filled so no gold shows: a honeycomb of cabochons for the open field,
        // then smaller stones dropped into what's left round the leaves and edges.
        const rowH = cell * 0.74;
        for (let zi = -Math.ceil(reach / rowH); zi <= Math.ceil(reach / rowH); zi++)
          for (let xi = -Math.ceil(reach / cell) - 1; xi <= Math.ceil(reach / cell) + 1; xi++) {
            const x = (xi + (zi % 2 ? 0.5 : 0)) * cell * 0.85, z = zi * rowH;
            if (inside(x, z, 0.3) && !blocked(x, z, cell * 0.3)) take(x, z);
          }
        const honey = got.length;
        for (const [x, z] of cands) if (inside(x, z, 0.2) && !blocked(x, z, cell * 0.22) && !near(x, z, cell * 0.6)) take(x, z);
        // Sizes: the honeycomb stones first, at full size; then each gap-filler as big as the room left round it.
        const rad: number[] = [];
        const roomAt = (q: { x: number; z: number }, upTo: number) => {
          const r = Math.hypot(q.x, q.z), th = theta(q.x, q.z);
          let room = Math.min(cell * 0.65, r - innerAt(th) + 0.05);
          for (let k = 0; k < upTo; k++) if (got[k] !== q) room = Math.min(room, Math.hypot(got[k].x - q.x, got[k].z - q.z) - (rad[k] ?? 0));
          for (const b of blocks) room = Math.min(room, Math.hypot(b.x - q.x, b.z - q.z) - b.r);
          return room;
        };
        got.forEach((q, i) => {
          if (i >= honey) { rad[i] = 0; return; }
          const r = Math.hypot(q.x, q.z), th = theta(q.x, q.z);
          let half = Math.min(cell * 0.52, r - innerAt(th) + 0.05);
          for (let k = 0; k < honey; k++) if (k !== i) half = Math.min(half, Math.hypot(got[k].x - q.x, got[k].z - q.z) / 2);
          for (const b of blocks) half = Math.min(half, Math.hypot(b.x - q.x, b.z - q.z) - b.r);
          rad[i] = half * 1.04;
        });
        for (let i = honey; i < got.length; i++) rad[i] = roomAt(got[i], i) * 0.97;
        got.forEach((q, i) => {
          if (rad[i] < cell * 0.26) return;
          const r = Math.hypot(q.x, q.z);
          const p = v3(q.x, dome > 0 ? domeY(r) : y, q.z), up = dome > 0 ? tilt(p) : Y.clone();
          const facing = v3(Math.cos(rnd() * 6.283), 0, Math.sin(rnd() * 6.283));
          const dir = facing.addScaledVector(up, -facing.dot(up)).normalize();
          const X = new THREE.Vector3().crossVectors(up, dir).normalize();
          put(key, { pos: p, dia: (rad[i] * 2) / ASPECT[fillShape], quat: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, up, dir)), up });
        });
      }
      const A = sprays ? 0 : 1440;
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
          if (sprays && blocked(p.x, p.z, sz * 0.42)) continue;
          const isAlt = !sprays && !!f.alt && (f.pattern === "vines" ? (((k - row) % (f.every + 1)) + (f.every + 1)) % (f.every + 1) === 0 : n % (f.every + 1) === f.every);
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
      sideStone = { gem: f.gem, color: f.color, cut: f.cut, shape: wallStone?.shape ?? f.shape, size: wallStone?.size ?? sz, alt: f.alt, every: f.every, ...(sprayInfo && wallStone ? { sprays: sprayInfo } : {}) };
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
      const x = Math.abs(p.x) * (1 - rounding);
      if (x >= finger.r) return Infinity;
      return topY(Math.hypot(p.x, p.y)) + finger.gy - Math.sqrt(finger.r * finger.r - x * x);
    };
    const depth: Depth = bend > 0 || finger ? (p) => Math.max(0.8, Math.min(shaped(p), clear(p))) : full;
    const plate = new THREE.Mesh(domedPlate(rim, topY, depth, finger), plateMetal(m));
    plate.userData.part = "metal";
    g.add(plate);
    if (wrap) g.add(sideStone!.sprays ? wallMosaic(m, rim, topY, depth, sideStone!) : wrapStones(m, rim, topY, depth, sideStone!));
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

export function plateMetal(m: Mats) {
  const satin = handPolished((m.metal as THREE.MeshPhysicalMaterial).clone());
  satin.side = THREE.DoubleSide;
  satin.roughness = 0.62;
  satin.envMapIntensity = 0.3;
  satin.color = satin.color.clone().multiplyScalar(0.72);
  satin.clearcoat = 0;
  return satin;
}

type Sprays = { stems: number; base: number; leafL: number; leafW: number };
type SideStone = { gem: Frame["gem"]; color: string; cut: Frame["cut"]; shape: Frame["shape"]; size: number; alt: Frame["alt"]; every: number; sprays?: Sprays };

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

// The sprays mosaic carried on down the dome's walls: the same stones packed edge to edge over the whole wall, and each
// leaf stem running on from the top's edge down the side, as on a domed mosaic ring.
function wallMosaic(m: Mats, rim: THREE.Vector2[], topY: (r: number) => number, depth: Depth, st: SideStone) {
  const g = new THREE.Group(), sp = st.sprays!, N = rim.length, cell = st.size;
  const SUB = 10;
  const arcOf = (p: THREE.Vector2) => { let a = 0, last = wallPoint(p, topY, depth, 0); for (let k = 1; k <= SUB; k++) { const q = wallPoint(p, topY, depth, (k / SUB) * (Math.PI / 2)); a += q.distanceTo(last); last = q; } return a; };
  const arcs = rim.map(arcOf);
  const along = [0];
  for (let i = 1; i <= N; i++) along.push(along[i - 1] + wallPoint(rim[i % N], topY, depth, 0).distanceTo(wallPoint(rim[i - 1], topY, depth, 0)));
  const perim = along[N];
  // (u, v): u runs round the rim, v down the wall from its top edge; both in mm along the surface.
  const rimAt = (u: number) => { const uu = ((u % perim) + perim) % perim; let i = 0; while (i < N - 1 && along[i + 1] < uu) i++; const t = (uu - along[i]) / Math.max(1e-6, along[i + 1] - along[i]); return { a: rim[i].clone().lerp(rim[(i + 1) % N], t), arc: arcs[i] + (arcs[(i + 1) % N] - arcs[i]) * t }; };
  const frame = (u: number, v: number) => {
    const { a, arc } = rimAt(u), phi = Math.min(1, v / Math.max(0.1, arc)) * (Math.PI / 2);
    const p = wallPoint(a, topY, depth, phi);
    const around = wallPoint(rimAt(u + 0.2).a, topY, depth, phi).sub(p).normalize();
    const down = wallPoint(a, topY, depth, Math.min(Math.PI / 2, phi + 0.05)).sub(p).normalize();
    const up = new THREE.Vector3().crossVectors(down, around).normalize();
    if (up.dot(v3(p.x, 0, p.z)) < 0) up.negate();
    return { p, around, down, up, arc };
  };
  const groups = new Map<string, Item[]>();
  const put = (key: string, it: Item) => (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);
  const orient = (up: THREE.Vector3, facing: THREE.Vector3) => {
    const dir = facing.clone().addScaledVector(up, -facing.dot(up)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, dir).normalize(), up, dir));
  };
  // Leaf stems continue down the wall below where each top stem meets the edge.
  const blocks: { u: number; v: number; r: number }[] = [], dots: Item[] = [];
  const leafKey = `${st.alt!.gem}|${st.alt!.color}|${st.alt!.cut}|${st.alt!.shape}`;
  for (let j = 0; j < sp.stems; j++) {
    const ang = (j / sp.stems) * Math.PI * 2 + sp.base;
    let best = 0, bd = Infinity;
    rim.forEach((p, i) => { const d = Math.abs(Math.atan2(Math.sin(Math.atan2(p.y, p.x) - ang), Math.cos(Math.atan2(p.y, p.x) - ang))); if (d < bd) { bd = d; best = i; } });
    const u0 = along[best], arc = arcs[best], sway = (j % 2 ? 1 : -1) * Math.min(3, arc * 0.35);
    for (let v = 0; v <= arc; v += 0.4) { const u = u0 + sway * (v / arc); const f = frame(u, v); dots.push({ pos: f.p.clone().addScaledVector(f.up, 0.12), dia: 0.34 }); blocks.push({ u, v, r: 0.17 }); }
    for (let v = sp.leafL * 0.5; v < arc - sp.leafL * 0.3; v += sp.leafL * 0.8) {
      const u = u0 + sway * (v / arc), f = frame(u, v);
      const stemDir = f.down.clone().addScaledVector(f.around, sway / arc).normalize();
      for (const sgn of [-1, 1]) {
        const du = sgn * sp.leafW * 0.75, f2 = frame(u + du, v + sp.leafL * 0.1);
        put(leafKey, { pos: f2.p.clone().addScaledVector(f2.up, 0.2), dia: sp.leafW, quat: orient(f2.up, stemDir.clone().applyAxisAngle(f2.up, sgn * 0.62)), up: f2.up });
        for (const k of [-0.3, 0, 0.3]) blocks.push({ u: u + du + sgn * sp.leafL * k * 0.5, v: v + sp.leafL * (0.1 + k * 0.8), r: sp.leafW * (k ? 0.42 : 0.55) });
      }
    }
  }
  const blocked = (u: number, v: number, r: number) => blocks.some((b) => { const du = Math.abs(b.u - u) % perim; return Math.hypot(Math.min(du, perim - du), b.v - v) < b.r + r; });
  // Fill: a honeycomb in (u, v) over the whole wall.
  const key = `${st.gem}|${st.color}|${st.cut}|${st.shape}`;
  const rowH = cell * 0.76, maxArc = Math.max(...arcs);
  let seed = 29;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let ri = 0; (ri + 0.4) * rowH < maxArc; ri++) {
    const v = (ri + 0.4) * rowH;
    for (let u = (ri % 2) * cell * 0.44; u < perim; u += cell * 0.88) {
      const f = frame(u, v);
      if (v > f.arc - cell * 0.3 || blocked(u, v, cell * 0.3)) continue;
      put(key, { pos: f.p.clone().addScaledVector(f.up, 0.3), dia: (cell * 0.9) / ASPECT[st.shape], quat: orient(f.up, f.around.clone().applyAxisAngle(f.up, rnd() * Math.PI)), up: f.up });
    }
  }
  groups.forEach((items, k) => {
    const [gem, color, cut, shape] = k.split("|");
    g.add(accents(m, gem as Frame["gem"], color, cut as Frame["cut"], items, shape as Frame["shape"], 0.27));
  });
  g.add(balls(m.satin, dots));
  return g;
}

const ROUNDING = 0.32;
// How far a dome's walls tuck in under it; decoFrames sets it for each top it builds.
let rounding = ROUNDING;

type Depth = number | ((p: THREE.Vector2) => number);
const depthAt = (depth: Depth, p: THREE.Vector2) => (typeof depth === "number" ? depth : depth(p));

function wallPoint(p: THREE.Vector2, topY: (r: number) => number, depth: Depth, phi: number) {
  const rr = Math.hypot(p.x, p.y), k = 1 - rounding + rounding * Math.cos(phi);
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
  const k = 1 - rounding, bottom: number[][] = [];
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
