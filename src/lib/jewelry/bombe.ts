import * as THREE from "three";
import { type CenterStone, type Design, type Frame } from "../design";
import { outlineFn } from "../ringModel";
import { v3 } from "./common";
import { type Mats } from "./materials";
import { ASPECT, type Item, accents, balls } from "./elements";
import { plateMetal } from "./ringHeads";

// A bombé mosaic head built as one shape: for every direction round the top, one smooth profile runs from the bezel
// over the dome, rolls over the rim and sweeps down to the finger and the shoulders. It is a single closed shell of
// metal, and the stones are laid over the whole of it in one pass (packed in random order, then grown into the gaps)
// with leaf branches that run unbroken from the bezel down the sides.

export const isBombe = (d: Design) =>
  d.type === "ring" && d.style === "deco" && d.options.decoWrap && d.options.decoDome > 0 && d.frames.some((f) => f.kind === "fill" && f.pattern === "sprays" && !!f.alt);

const NT = 192, NK = 30, SHELL = 0.5;

function stoneEdge(c: CenterStone) {
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm), t = THREE.MathUtils.degToRad(c.rotation ?? 0), bins = 360, r = new Float32Array(bins);
  for (let i = 0; i < 1440; i++) {
    const [x0, z0] = fn(i / 1440), x = x0 * Math.cos(t) + z0 * Math.sin(t), z = -x0 * Math.sin(t) + z0 * Math.cos(t);
    const b = Math.round(((Math.atan2(z, x) / (2 * Math.PI)) * bins + bins) % bins) % bins;
    r[b] = Math.max(r[b], Math.hypot(x, z));
  }
  for (let p = 0; p < 4; p++) for (let b = 0; b < bins; b++) if (!r[b]) r[b] = Math.max(r[(b + 1) % bins], r[(b + bins - 1) % bins]);
  return (a: number) => r[Math.round(((a / (2 * Math.PI)) * bins + bins * 2) % bins) % bins];
}

// Points every 0.33 mm round a leaf (marquise) outline of the given length and width, centred on the leaf.
function leafOutline(L: number, W: number) {
  const fn = outlineFn("marquise", L, W), pts: [number, number][] = [];
  let last: [number, number] | null = null, run = 0;
  for (let i = 0; i <= 400; i++) {
    const [x, z] = fn(i / 400);
    if (last) run += Math.hypot(x - last[0], z - last[1]);
    if (!last || run >= 0.33) { pts.push([x, z]); run = 0; }
    last = [x, z];
  }
  return pts;
}

export function bombeHead(d: Design, m: Mats, c: CenterStone, finger: { r: number; gy: number }) {
  const g = new THREE.Group();
  g.userData.part = "accents";
  g.userData.keep = true;
  const f = [...d.frames].reverse().find((x) => x.kind === "fill" && x.pattern === "sprays")! as Frame & { alt: NonNullable<Frame["alt"]> };
  const o = d.options;
  // The measured size is over the stones, which stand about 0.9 mm proud of the metal at the edge.
  const halfL = (o.decoLengthMm > 0 ? o.decoLengthMm : c.lengthMm * 1.8) / 2 - 0.9, halfW = (o.decoWidthMm > 0 ? o.decoWidthMm : c.widthMm * 2.6) / 2 - 0.9;
  const turn = THREE.MathUtils.degToRad(f.turn ?? 0), rot = THREE.MathUtils.degToRad(c.rotation ?? 0);
  const along = v3(Math.sin(rot), 0, Math.cos(rot)), across = v3(Math.cos(rot), 0, -Math.sin(rot));
  const edge = stoneEdge(c);

  // The top's outline: a rounded square (turned to a lozenge by the frame's turn), stretched to the measured size.
  const p = 2.7, raw = Array.from({ length: NT }, (_, i) => {
    const t = (i / NT) * Math.PI * 2, cx = Math.cos(t), sz = Math.sin(t);
    const q = [Math.sign(cx) * Math.abs(cx) ** (2 / p), Math.sign(sz) * Math.abs(sz) ** (2 / p)];
    return [q[0] * Math.cos(turn) - q[1] * Math.sin(turn), q[0] * Math.sin(turn) + q[1] * Math.cos(turn)];
  });
  const ma = Math.max(...raw.map(([x, z]) => Math.abs(x * across.x + z * across.z))), ml = Math.max(...raw.map(([x, z]) => Math.abs(x * along.x + z * along.z)));
  const outline = raw.map(([x, z]) => {
    const a = (x * across.x + z * across.z) / ma * halfW, l = (x * along.x + z * along.z) / ml * halfL;
    return across.clone().multiplyScalar(a).addScaledVector(along, l);
  });

  // Heights (relative to the centre stone's girdle): the dome falls from the bezel to the rim, then the side sweeps
  // down to the finger, landing on the shoulders across the finger.
  const yTop = 0, drop = 1.4 + 2.4 * Math.min(1, o.decoDome);
  const grid: THREE.Vector3[][] = outline.map((O) => {
    // The shell starts against the bezel wall, so the setting and the dome are one piece of metal.
    const dir = v3(O.x, 0, O.z).normalize(), a = Math.atan2(O.z, O.x), rb = edge(a) + 0.3, ro = Math.hypot(O.x, O.z);
    const top = Array.from({ length: 12 }, (_, k) => {
      const t = k / 11, r = rb + (ro - rb) * t;
      return dir.clone().multiplyScalar(r).setY(yTop - drop * t ** 1.7);
    });
    const R = top[top.length - 1];
    // The foot of the side lands on the outside of the band (on top of it at the front and back, on the shoulders at
    // the sides), so the head flows into the shoulders instead of pinching in under itself.
    const bandOut = finger.r + 1.3;
    const ex = Math.sign(O.x) * Math.min(Math.abs(O.x) * 0.92, bandOut * 0.95), ez = O.z * 0.9;
    const E = v3(ex, -finger.gy + Math.sqrt(bandOut * bandOut - ex * ex), ez);
    const span = Math.max(1, R.y - E.y), outward = dir.clone();
    // The rim rolls over, then the side tucks in a little as it runs down to the finger.
    const P1 = R.clone().addScaledVector(outward, span * 0.14).add(v3(0, -span * 0.32, 0));
    const P2 = E.clone().add(v3(0, span * 0.42, 0));
    const side = new THREE.CubicBezierCurve3(R, P1, P2, E);
    const n = NK - top.length;
    return [...top, ...Array.from({ length: n }, (_, k) => side.getPoint((k + 1) / n))];
  });

  // The shell: outer surface, an inner surface 1 mm in, closed at the bezel and at the foot.
  const normal = (i: number, k: number) => {
    const a = grid[(i + 1) % NT][k].clone().sub(grid[(i + NT - 1) % NT][k]);
    const b = grid[i][Math.min(NK - 1, k + 1)].clone().sub(grid[i][Math.max(0, k - 1)]);
    const n = new THREE.Vector3().crossVectors(b, a).normalize();
    // Outward is away from the head's centre line: up on the dome, sideways on the walls.
    const out = v3(grid[i][k].x, 0, grid[i][k].z).normalize().add(v3(0, k < 12 ? 0.8 : 0.1, 0));
    return n.dot(out) < 0 ? n.negate() : n;
  };
  const normals = grid.map((col, i) => col.map((_, k) => normal(i, k)));
  const pos: number[] = [], idx: number[] = [];
  const vid = (v: THREE.Vector3) => { pos.push(v.x, v.y, v.z); return pos.length / 3 - 1; };
  const outer = grid.map((col) => col.map(vid));
  const inner = grid.map((col, i) => col.map((v, k) => vid(v.clone().addScaledVector(normals[i][k], -SHELL))));
  const quad = (a: number, b: number, cc: number, dd: number) => idx.push(a, b, cc, a, cc, dd);
  for (let i = 0; i < NT; i++) {
    const j = (i + 1) % NT;
    for (let k = 0; k < NK - 1; k++) { quad(outer[i][k], outer[i][k + 1], outer[j][k + 1], outer[j][k]); quad(inner[i][k], inner[j][k], inner[j][k + 1], inner[i][k + 1]); }
    quad(outer[i][0], outer[j][0], inner[j][0], inner[i][0]);
    quad(outer[i][NK - 1], inner[i][NK - 1], inner[j][NK - 1], outer[j][NK - 1]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const shell = new THREE.Mesh(geo, plateMetal(m));
  shell.userData.part = "metal";
  g.add(shell);

  // Points on the surface between grid lines, with the surface's facing.
  const at = (u: number, s: number) => {
    const uu = ((u % NT) + NT) % NT, i = Math.floor(uu), j = (i + 1) % NT, a = uu - i;
    const ss = Math.min(NK - 1.001, Math.max(0, s)), k = Math.floor(ss), b = ss - k;
    const mix = (A: THREE.Vector3[][]) => A[i][k].clone().multiplyScalar((1 - a) * (1 - b)).addScaledVector(A[j][k], a * (1 - b)).addScaledVector(A[i][k + 1], (1 - a) * b).addScaledVector(A[j][k + 1], a * b);
    return { p: mix(grid), n: mix(normals).normalize() };
  };
  const orient = (n: THREE.Vector3, facing: THREE.Vector3) => {
    const dir = facing.clone().addScaledVector(n, -facing.dot(n)).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(n, dir).normalize(), n, dir));
  };
  let seed = 41;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const groups = new Map<string, Item[]>();
  const put = (key: string, it: Item) => (groups.get(key) ?? groups.set(key, []).get(key)!).push(it);

  // Leaf branches: stems from the bezel out over the dome and down the side, drifting round as they go, with leaves
  // in pairs along them.
  const leafShape = f.alt.shape, leafL = Math.min(3.4, Math.max(2.2, (f.widthMm || 2.5) * 1.1)), leafW = leafL / ASPECT[leafShape];
  const leafKey = `${f.alt.gem}|${f.alt.color}|${f.alt.cut}|${leafShape}`;
  const blocks: { p: THREE.Vector3; r: number }[] = [], beads: Item[] = [], leafBeads: Item[] = [], leaves: THREE.Vector3[] = [];
  const stems = 8;
  for (let jn = 0; jn < stems; jn++) {
    const u0 = ((jn + 0.5) / stems) * NT, drift = (jn % 2 ? 1 : -1) * NT * 0.05;
    const path = Array.from({ length: 160 }, (_, q) => { const s = (q / 159) * (NK - 1.6); return at(u0 + drift * (s / (NK - 1)), s); });
    let run = 0, nextBead = 0, nextLeaf = leafL * 0.45, leafCount = jn;
    const total = path.reduce((a, pp, q) => (q ? a + pp.p.distanceTo(path[q - 1].p) : 0), 0);
    for (let q = 1; q < path.length; q++) {
      run += path[q].p.distanceTo(path[q - 1].p);
      const { p: pt, n } = path[q], tan = pt.clone().sub(path[q - 1].p).normalize();
      // The branch is only the path the leaves follow; on the piece there is no beaded line along it.
      if (run >= nextBead) nextBead += 0.33;
      // Leaves stop a leaf's length short of where the branch runs off the foot of the dome.
      if (run >= nextLeaf && total - run > leafL * 0.75 + 0.4) {
        // Leaves alternate from one side of the branch to the other, as on the piece.
        nextLeaf += leafL * 0.72;
        const side = new THREE.Vector3().crossVectors(n, tan).normalize();
        const pair: THREE.Vector3[] = [];
        for (const sgn of [(leafCount++ % 2) * 2 - 1]) {
          const c0 = pt.clone().addScaledVector(side, sgn * (leafW * 0.8 + 0.3)).addScaledVector(tan, leafL * 0.12);
          // Where a branch turns steeply down the side, leaves can bunch up; one that would touch a leaf of another
          // pair is left out (the two leaves of a pair sit side by side by design).
          if (leaves.some((q) => q.distanceTo(c0) < leafL * 0.98 + 0.4)) continue;
          pair.push(c0);
          const facing = tan.clone().applyAxisAngle(n, sgn * 0.62);
          put(leafKey, { pos: c0.clone().addScaledVector(n, 0.04), dia: leafW, quat: orient(n, facing), up: n });
          // Each leaf sits in its own cell edged with milgrain that follows the leaf's outline.
          const ax = facing.clone().addScaledVector(n, -facing.dot(n)).normalize(), sx = new THREE.Vector3().crossVectors(n, ax).normalize();
          const rim = leafOutline(leafL + 0.62, leafW + 0.62);
          // Dropped by the dome's curvature (about 12 mm radius) so every bead sits on the metal, not above it.
          for (const [x, z] of rim) leafBeads.push({ pos: c0.clone().addScaledVector(sx, x).addScaledVector(ax, z).addScaledVector(n, 0.06 - (x * x + z * z) / 20), dia: 0.36 });
          // The leaf's cell, with its beaded border, keeps the pink stones clear.
          for (const [k, r] of [[-0.44, 0.2], [-0.3, 0.36], [0, 0.5], [0.3, 0.36], [0.44, 0.2]]) blocks.push({ p: c0.clone().addScaledVector(facing, leafL * k), r: leafW * r + 0.24 });
        }
        leaves.push(...pair);
      }
    }
  }

  // The mosaic: candidates over the whole surface in random order, kept where they don't crowd a neighbour, a leaf or
  // a stem, then each grown to fill the room round it.
  // Sugarloaf stones at their real size first (about the frame's stone width), then smaller ones cut to fill the gaps
  // between them, as a setter fills a mosaic. Each is sized to its room so none touches a neighbour.
  const big = Math.min(2.6, Math.max(1.4, (f.widthMm || 2.5) * 0.85)), cell = big;
  const fillShape = ASPECT[f.shape] > 1.1 ? "cushion" : f.shape;
  const key = `${f.gem}|${f.color}|${f.cut}|${fillShape}`;
  const cands: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  const toFoot = new Map<{ p: THREE.Vector3; n: THREE.Vector3 }, number>();
  for (let i = 0; i < NT * 3; i++) {
    const foot = at(i / 3, NK - 1).p;
    for (let s = 0.35; s <= NK - 1.15; s += 0.14) { const c0 = at(i / 3, s); toFoot.set(c0, c0.p.distanceTo(foot)); cands.push(c0); }
  }
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  const hash = new Map<string, number[]>(), kept: { p: THREE.Vector3; n: THREE.Vector3; r: number }[] = [];
  const keyOf = (v: THREE.Vector3) => [Math.floor(v.x / cell), Math.floor(v.y / cell), Math.floor(v.z / cell)];
  // Room round a point: up to the nearest placed stone's edge, a leaf or stem, or the given cap.
  const roomAt = (v: THREE.Vector3, cap: number) => {
    let room = cap;
    const [x, y, z] = keyOf(v);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) for (const k of hash.get(`${x + a},${y + b},${z + e}`) ?? []) room = Math.min(room, kept[k].p.distanceTo(v) - kept[k].r);
    for (const b of blocks) room = Math.min(room, b.p.distanceTo(v) - b.r);
    return room;
  };
  const place = (cnd: { p: THREE.Vector3; n: THREE.Vector3 }, r: number) => {
    const kk = keyOf(cnd.p).join(",");
    (hash.get(kk) ?? hash.set(kk, []).get(kk)!).push(kept.length);
    kept.push({ ...cnd, r });
  };
  // Clearance between neighbouring stones, for the milgrain wall of each cell.
  const wall = 0.1;
  for (const [cap, least] of [[big / 2, big * 0.3], [big * 0.36, big * 0.2], [big * 0.24, big * 0.14]] as const) {
    for (const cnd of cands) {
      const room = Math.min(roomAt(cnd.p, cap + wall) - wall, (toFoot.get(cnd) ?? 9) - 0.35);
      if (room >= least) place(cnd, Math.min(cap, room));
    }
  }
  for (const st of kept) {
    const facing = v3(Math.cos(rnd() * 6.283), 0, Math.sin(rnd() * 6.283));
    // A cushion's corners reach past its width, so it is sized to sit inside its room without touching a neighbour.
    put(key, { pos: st.p.clone().addScaledVector(st.n, 0.1), dia: (st.r * 2 * 0.86) / ASPECT[fillShape], quat: orient(st.n, facing), up: st.n });
  }

  // Milgrain beading round the bezel.
  beads.push(...Array.from({ length: NT }, (_, i) => ({ pos: grid[i][1].clone().addScaledVector(normals[i][1], 0.08), dia: 0.42 })));
  groups.forEach((items, k) => {
    const [gem, color, cut, shape] = k.split("|");
    const set = accents(m, gem as Frame["gem"], color, cut as Frame["cut"], items, shape as Frame["shape"], 0.27);
    // Each stone sits in an open-backed cell: a light hole through the metal behind it, as on the real piece.
    set.userData.openBack = 0.72;
    g.add(set);
  });
  g.add(balls(m.satin, beads));
  // Bright polished milgrain round each leaf, as on the piece.
  g.add(balls(m.metal, leafBeads));
  return { group: g };
}
