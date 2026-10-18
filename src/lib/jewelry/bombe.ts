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

const NT = 192, NK = 30, SHELL = 0.6;

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
  const fingerY = (x: number) => -finger.gy + Math.sqrt(Math.max(0, finger.r * finger.r - x * x)) + 0.4;
  const grid: THREE.Vector3[][] = outline.map((O) => {
    // The shell starts against the bezel wall, so the setting and the dome are one piece of metal.
    const dir = v3(O.x, 0, O.z).normalize(), a = Math.atan2(O.z, O.x), rb = edge(a) + 0.3, ro = Math.hypot(O.x, O.z);
    const top = Array.from({ length: 12 }, (_, k) => {
      const t = k / 11, r = rb + (ro - rb) * t;
      return dir.clone().multiplyScalar(r).setY(yTop - drop * t ** 1.7);
    });
    const R = top[top.length - 1];
    const ex = Math.sign(O.x) * Math.min(Math.abs(O.x) * 0.9, finger.r * 0.95), ez = O.z * 0.88;
    const E = v3(ex, fingerY(ex), ez);
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
  const blocks: { p: THREE.Vector3; r: number }[] = [], beads: Item[] = [];
  const stems = 8;
  for (let jn = 0; jn < stems; jn++) {
    const u0 = ((jn + 0.5) / stems) * NT, drift = (jn % 2 ? 1 : -1) * NT * 0.05;
    const path = Array.from({ length: 160 }, (_, q) => { const s = (q / 159) * (NK - 1.6); return at(u0 + drift * (s / (NK - 1)), s); });
    let run = 0, nextBead = 0, nextLeaf = leafL * 0.45;
    for (let q = 1; q < path.length; q++) {
      run += path[q].p.distanceTo(path[q - 1].p);
      const { p: pt, n } = path[q], tan = pt.clone().sub(path[q - 1].p).normalize();
      if (run >= nextBead) { beads.push({ pos: pt.clone().addScaledVector(n, 0.05), dia: 0.34 }); blocks.push({ p: pt, r: 0.2 }); nextBead += 0.4; }
      if (run >= nextLeaf) {
        nextLeaf += leafL * 1.25;
        const side = new THREE.Vector3().crossVectors(n, tan).normalize();
        for (const sgn of [-1, 1]) {
          const c0 = pt.clone().addScaledVector(side, sgn * leafW * 0.8).addScaledVector(tan, leafL * 0.12);
          const facing = tan.clone().applyAxisAngle(n, sgn * 0.62);
          put(leafKey, { pos: c0.clone().addScaledVector(n, 0.3), dia: leafW, quat: orient(n, facing), up: n });
          for (const k of [-0.3, 0, 0.3]) blocks.push({ p: c0.clone().addScaledVector(facing, leafL * k), r: leafW * (k ? 0.36 : 0.5) });
        }
      }
    }
  }

  // The mosaic: candidates over the whole surface in random order, kept where they don't crowd a neighbour, a leaf or
  // a stem, then each grown to fill the room round it.
  const cell = Math.min(1.6, Math.max(1.1, (f.widthMm || 2.5) * 0.6));
  const fillShape = ASPECT[f.shape] > 1.1 ? "cushion" : f.shape;
  const key = `${f.gem}|${f.color}|${f.cut}|${fillShape}`;
  const cands: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  for (let i = 0; i < NT * 2; i++) for (let s = 0.35; s <= NK - 1.15; s += 0.2) cands.push(at(i / 2, s));
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  const hash = new Map<string, number[]>(), kept: { p: THREE.Vector3; n: THREE.Vector3 }[] = [];
  const keyOf = (v: THREE.Vector3) => [Math.floor(v.x / cell), Math.floor(v.y / cell), Math.floor(v.z / cell)];
  const near = (v: THREE.Vector3, dist: number) => {
    const [x, y, z] = keyOf(v);
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let e = -1; e <= 1; e++) for (const k of hash.get(`${x + a},${y + b},${z + e}`) ?? []) if (kept[k].p.distanceTo(v) < dist) return true;
    return false;
  };
  const blocked = (v: THREE.Vector3, r: number) => blocks.some((b) => b.p.distanceTo(v) < b.r + r);
  for (const cnd of cands) {
    if (blocked(cnd.p, cell * 0.25) || near(cnd.p, cell * 0.78)) continue;
    const kk = keyOf(cnd.p).join(",");
    (hash.get(kk) ?? hash.set(kk, []).get(kk)!).push(kept.length);
    kept.push(cnd);
  }
  for (const st of kept) {
    let room = cell * 0.7;
    for (const o2 of kept) if (o2 !== st) room = Math.min(room, o2.p.distanceTo(st.p) / 2);
    for (const b of blocks) room = Math.min(room, b.p.distanceTo(st.p) - b.r);
    if (room < cell * 0.25) continue;
    const facing = v3(Math.cos(rnd() * 6.283), 0, Math.sin(rnd() * 6.283));
    put(key, { pos: st.p.clone().addScaledVector(st.n, 0.28), dia: (room * 2 * 1.06) / ASPECT[fillShape], quat: orient(st.n, facing), up: st.n });
  }

  // Milgrain beading round the bezel.
  beads.push(...Array.from({ length: NT }, (_, i) => ({ pos: grid[i][1].clone().addScaledVector(normals[i][1], 0.08), dia: 0.42 })));
  groups.forEach((items, k) => {
    const [gem, color, cut, shape] = k.split("|");
    g.add(accents(m, gem as Frame["gem"], color, cut as Frame["cut"], items, shape as Frame["shape"], 0.27));
  });
  g.add(balls(m.satin, beads));
  return { group: g };
}
