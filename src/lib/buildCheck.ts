import * as THREE from "three";
import type { Design } from "./design";
import { isMetal } from "./studio/spec";

export type BuildIssue = { level: "problem" | "warning"; message: string; keys: string[] };
type Ref = { group: THREE.Object3D } | { mesh: THREE.InstancedMesh; index: number };
type Stone = { pos: THREE.Vector3; quat: THREE.Quaternion; a: number; b: number; h: number; key?: string; refs: Ref[] };

const footprints = new WeakMap<THREE.BufferGeometry, { x: number; z: number }>();
function footprint(g: THREE.BufferGeometry) {
  let f = footprints.get(g);
  if (!f) {
    g.computeBoundingBox();
    const s = g.boundingBox!.getSize(new THREE.Vector3());
    f = { x: s.x, z: s.z };
    footprints.set(g, f);
  }
  return f;
}

export function stonesIn(root: THREE.Object3D): Stone[] {
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const out: Stone[] = [], seen = new Map<string, Stone>(), groups = new Set<THREE.Object3D>();
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
  const add = (st: Stone) => {
    const id = `${st.pos.x.toFixed(2)},${st.pos.y.toFixed(2)},${st.pos.z.toFixed(2)}`;
    const had = seen.get(id);
    if (had) { had.refs.push(...st.refs); return; }
    seen.set(id, st);
    out.push(st);
  };
  root.traverse((o) => {
    if (o.userData.stone && !groups.has(o)) {
      groups.add(o);
      if (o.userData.strung) return;
      m.multiplyMatrices(toRoot, o.matrixWorld).decompose(p, q, sc);
      const { L, W } = o.userData.stone as { L: number; W: number };
      let key: string | undefined;
      for (let up: THREE.Object3D | null = o; up && !key; up = up.parent) if (typeof up.userData.stoneKey === "string") key = up.userData.stoneKey;
      add({ pos: p.clone(), quat: q.clone(), a: Math.abs(W * sc.x) / 2, b: Math.abs(L * sc.z) / 2, h: Math.min(W, L) * 0.6 * Math.abs(sc.y), key, refs: [{ group: o }] });
      return;
    }
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || isMetal(mesh.material)) return;
    for (let up: THREE.Object3D | null = o.parent; up; up = up.parent) if (up.userData.stone) return;
    const inst = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh) : null;
    if (!inst || o.userData.strung || o.parent?.userData.strung) return;
    const f = footprint(mesh.geometry);
    const keys = mesh.userData.keys as string[] | undefined;
    for (let i = 0; i < inst.count; i++) {
      inst.getMatrixAt(i, m); m.premultiply(mesh.matrixWorld).premultiply(toRoot);
      m.decompose(p, q, sc);
      const a = Math.abs(f.x * sc.x) / 2, b = Math.abs(f.z * sc.z) / 2;
      add({ pos: p.clone(), quat: q.clone(), a, b, h: Math.min(a, b) * 1.2, key: keys?.[i] || undefined, refs: [{ mesh: inst, index: i }] });
    }
  });
  return out;
}

const X = new THREE.Vector3(1, 0, 0), Yv = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
function reachAlong(s: Stone, dir: THREE.Vector3) {
  const lx = dir.dot(X.clone().applyQuaternion(s.quat)), lz = dir.dot(Z.clone().applyQuaternion(s.quat));
  const n = Math.hypot(lx, lz) || 1;
  return 1 / Math.sqrt((lx / n / s.a) ** 2 + (lz / n / s.b) ** 2);
}

function pairs(stones: Stone[], clearance: number, visit: (i: number, j: number, room: number) => void) {
  const cell = 4, grid = new Map<string, number[]>();
  const cellOf = (v: THREE.Vector3) => [Math.floor(v.x / cell), Math.floor(v.y / cell), Math.floor(v.z / cell)];
  stones.forEach((s, i) => { const k = cellOf(s.pos).join(","); (grid.get(k) ?? grid.set(k, []).get(k)!).push(i); });
  const d = new THREE.Vector3(), n = new THREE.Vector3();
  stones.forEach((s, i) => {
    const [cx, cy, cz] = cellOf(s.pos);
    n.copy(Yv).applyQuaternion(s.quat);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const j of grid.get(`${cx + dx},${cy + dy},${cz + dz}`) ?? []) {
        if (j <= i) continue;
        const t = stones[j];
        d.subVectors(t.pos, s.pos);
        const along = d.dot(n);
        if (Math.abs(along) > (s.h + t.h) / 2) continue;
        const flat = d.clone().addScaledVector(n, -along), dist = flat.length();
        if (dist < 1e-6) { visit(i, j, 0); continue; }
        flat.divideScalar(dist);
        const need = reachAlong(s, flat) + reachAlong(t, flat.clone().negate());
        if (dist < need - clearance) visit(i, j, Math.max(0, dist - clearance) / need);
      }
    }
  });
}

export function overlappingStones(stones: Stone[], clearance = 0.05) {
  const hit = new Set<number>();
  pairs(stones, clearance, (i, j) => { hit.add(i); hit.add(j); });
  return hit;
}

function shrink(st: Stone, k: number) {
  const M = new THREE.Matrix4(), P = new THREE.Matrix4(), S = new THREE.Matrix4().makeScale(k, k, k), inv = new THREE.Matrix4();
  for (const ref of st.refs) {
    if ("group" in ref) { ref.group.scale.multiplyScalar(k); continue; }
    const { mesh, index } = ref;
    const parent = mesh.parent;
    const sibs = (parent ? parent.children : [mesh]).filter((o): o is THREE.InstancedMesh => (o as THREE.InstancedMesh).isInstancedMesh);
    mesh.getMatrixAt(index, M);
    inv.copy(M).invert();
    for (const sib of sibs) {
      if (sib.count === mesh.count * 4 && sib !== mesh) {
        for (let j = 0; j < 4; j++) {
          sib.getMatrixAt(index * 4 + j, P);
          const local = inv.clone().multiply(P);
          sib.setMatrixAt(index * 4 + j, M.clone().multiply(S).multiply(local));
        }
        sib.instanceMatrix.needsUpdate = true;
      }
    }
    for (const sib of sibs) {
      if (sib.count !== mesh.count) continue;
      sib.getMatrixAt(index, P);
      sib.setMatrixAt(index, P.multiply(S));
      sib.instanceMatrix.needsUpdate = true;
    }
  }
}

export function resolveOverlaps(root: THREE.Object3D, keep: Set<string> = new Set(), clearance = 0.08, floor = 0.6) {
  const shrunk = new Map<string, number>();
  for (let pass = 0; pass < 4; pass++) {
    const stones = stonesIn(root);
    const k = new Float32Array(stones.length).fill(1);
    let any = false;
    const fixed = (st: Stone) => st.refs.some((r) => "group" in r) || (!!st.key && keep.has(st.key));
    pairs(stones, clearance, (i, j, room) => {
      const fi = fixed(stones[i]), fj = fixed(stones[j]);
      if (fi && fj) return;
      any = true;
      const f = Math.max(0.85, fi || fj ? room * room : room);
      if (!fi) k[i] = Math.min(k[i], f);
      if (!fj) k[j] = Math.min(k[j], f);
    });
    if (!any) break;
    stones.forEach((st, i) => {
      if (k[i] >= 1) return;
      const id = `${st.pos.x.toFixed(2)},${st.pos.y.toFixed(2)},${st.pos.z.toFixed(2)}`;
      const sofar = shrunk.get(id) ?? 1, size = (Math.min(st.a, st.b) * 2) / sofar;
      const next = Math.max(floor, Math.min(1, 0.75 / Math.max(1e-3, size)), sofar * k[i]);
      if (next >= sofar - 1e-4) return;
      shrink(st, next / sofar);
      shrunk.set(id, next);
    });
    root.updateMatrixWorld(true);
  }
  return shrunk.size;
}

// Problems with the stones themselves, for the checks in the CAD download's README.
export function checkBuild(d: Design, root: THREE.Object3D): BuildIssue[] {
  const stones = stonesIn(root);
  const issues: BuildIssue[] = [];
  const keysOf = (idx: Iterable<number>) => [...idx].map((i) => stones[i].key).filter((k): k is string => !!k);
  const overlap = overlappingStones(stones);
  if (overlap.size) issues.push({ level: "problem", keys: keysOf(overlap), message: `${overlap.size} stones overlap their neighbours. Overlapping stones can't be set or machined; make them smaller or space them out.` });
  const tiny = stones.map((s, i) => [s, i] as const).filter(([s]) => Math.min(s.a, s.b) * 2 < 0.7).map(([, i]) => i);
  if (tiny.length) issues.push({ level: "warning", keys: keysOf(tiny), message: `${tiny.length} stones are under 0.7 mm across, too small to set reliably.` });
  if (d.type === "necklace" && d.style === "by-the-yard" && d.options.stoneLink === "drilled") {
    const small = stones.map((s, i) => [s, i] as const).filter(([s]) => Math.min(s.a, s.b) * 2 < 2.5).map(([, i]) => i);
    if (small.length) issues.push({ level: "problem", keys: keysOf(small), message: `${small.length} drilled stones are under 2.5 mm: too small to drill safely. Use bezels for those, or larger stones.` });
    if (d.center.cut === "faceted") issues.push({ level: "warning", keys: [], message: "Drilled stones are usually flat-backed rose cuts; a full faceted stone is weaker where it's drilled." });
  }
  return issues;
}
