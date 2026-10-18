import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import Module from "manifold-3d";
import { isMetal } from "./studio/spec";

type Wasm = Awaited<ReturnType<typeof Module>>;
type Solid = InstanceType<Wasm["Manifold"]>;
let loading: Promise<Wasm> | null = null;
const engine = () => (loading ??= Module().then((w) => { w.setup(); return w; }));

export type SolidReport = { pieces: number; joined: number; rebuilt: number; skipped: string[]; seats: number; specks?: number; watertight: boolean; volumeMm3: number };

const toMat4 = (m: THREE.Matrix4) => Array.from(m.elements) as unknown as Parameters<Solid["transform"]>[0];

function fromGeometry(w: Wasm, geo: THREE.BufferGeometry, tolerance: number): Solid | null {
  const g0 = new THREE.BufferGeometry();
  g0.setAttribute("position", geo.getAttribute("position").clone());
  if (geo.index) g0.setIndex(geo.index.clone());
  const g = mergeVertices(g0, tolerance);
  const pos = g.getAttribute("position").array as ArrayLike<number>;
  const idx = g.index ? Uint32Array.from(g.index.array) : Uint32Array.from({ length: pos.length / 3 }, (_, i) => i);
  const build = (tris: Uint32Array) => {
    const mesh = new w.Mesh({ numProp: 3, vertProperties: Float32Array.from(pos), triVerts: tris });
    mesh.merge();
    const s = new w.Manifold(mesh);
    if (s.status() !== "NoError" || s.isEmpty()) { s.delete(); return null; }
    return s;
  };
  try {
    const s = build(idx);
    if (!s || s.volume() > 0) return s;
    s.delete();
    const flipped = idx.slice();
    for (let i = 0; i < flipped.length; i += 3) { const t = flipped[i + 1]; flipped[i + 1] = flipped[i + 2]; flipped[i + 2] = t; }
    return build(flipped);
  } catch {
    return null;
  }
}

function tubeSolid(w: Wasm, geo: THREE.TubeGeometry): Solid | null {
  const p = geo.parameters;
  if (!p?.path || !(p.radius > 0)) return null;
  const n = Math.max(2, Math.min(200, p.tubularSegments ?? 32));
  const pts = Array.from({ length: n + 1 }, (_, i) => p.path.getPointAt(Math.min(1, i / n)));
  const seg = Math.max(8, Math.min(24, p.radialSegments ?? 12));
  const ball = w.Manifold.sphere(p.radius, seg);
  const caps: Solid[] = [];
  for (let i = 0; i < n; i++) {
    const a = ball.translate([pts[i].x, pts[i].y, pts[i].z]), b = ball.translate([pts[i + 1].x, pts[i + 1].y, pts[i + 1].z]);
    caps.push(w.Manifold.hull([a, b]));
    a.delete(); b.delete();
  }
  ball.delete();
  const out = w.Manifold.union(caps);
  caps.forEach((c) => c.delete());
  return out;
}

function solidFor(w: Wasm, geo: THREE.BufferGeometry): { solid: Solid | null; rebuilt: boolean } {
  if (geo.type === "TubeGeometry") {
    const direct = fromGeometry(w, geo, 1e-4);
    if (direct) return { solid: direct, rebuilt: false };
    return { solid: tubeSolid(w, geo as THREE.TubeGeometry), rebuilt: true };
  }
  const direct = fromGeometry(w, geo, 1e-4) ?? fromGeometry(w, geo, 2e-3);
  return { solid: direct, rebuilt: false };
}

function seatCutter(w: Wasm, geo: THREE.BufferGeometry): Solid | null {
  geo.computeBoundingBox();
  const box = geo.boundingBox!, size = box.getSize(new THREE.Vector3());
  const span = Math.max(size.x, size.z);
  if (!(span > 0)) return null;
  const pos = geo.getAttribute("position");
  let girdle = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const r = Math.hypot(pos.getX(i), pos.getZ(i));
    if (r > span * 0.47) girdle = Math.max(girdle, pos.getY(i));
  }
  if (!Number.isFinite(girdle)) girdle = 0;
  const pts: [number, number, number][] = [];
  const lift = Math.min(span * 0.06, 0.4);
  // About 0.05 mm of clearance all round, whatever the stone's size (a percentage would eat the gallery under a big stone).
  const k = 1 + 0.1 / span;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) * k, y = pos.getY(i), z = pos.getZ(i) * k;
    if (y <= girdle + 1e-6) {
      pts.push([x, y - span * 0.01, z]);
      if (y >= girdle - span * 0.04) pts.push([x, girdle + lift, z]);
    }
  }
  if (pts.length < 4) return null;
  try { return w.Manifold.hull(pts); } catch { return null; }
}

export async function solidMetal(root: THREE.Object3D, opts: { seats?: boolean } = {}): Promise<{ geometry: THREE.BufferGeometry; report: SolidReport } | null> {
  const w = await engine();
  root.updateMatrixWorld(true);
  const toRoot = root.matrixWorld.clone().invert();
  const metal: Solid[] = [], cutters: Solid[] = [];
  const cache = new Map<string, Solid | null>(), seatCache = new Map<string, Solid | null>();
  const report: SolidReport = { pieces: 0, joined: 0, rebuilt: 0, skipped: [], seats: 0, specks: 0, watertight: false, volumeMm3: 0 };
  const m = new THREE.Matrix4(), rel = new THREE.Matrix4();
  const seen = new Set<string>();

  const findings = new Set<THREE.Object3D>(), drilled = new Set<THREE.Object3D>();
  root.traverse((o) => { if (o.userData.finding) o.traverse((k) => findings.add(k)); if (o.userData.strung) o.traverse((k) => drilled.add(k)); });
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || findings.has(o)) return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshPhysicalMaterial;
    if (!mat || (mat.transparent && mat.opacity < 0.5)) return;
    rel.multiplyMatrices(toRoot, mesh.matrixWorld);
    const inst = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh) : null;
    const count = inst ? inst.count : 1;
    const each = (fn: (mm: THREE.Matrix4) => void) => {
      for (let i = 0; i < count; i++) {
        if (inst) { inst.getMatrixAt(i, m); m.premultiply(rel); } else m.copy(rel);
        fn(m);
      }
    };
    if (isMetal(mesh.material)) {
      const key = mesh.geometry.uuid;
      if (!cache.has(key)) {
        const { solid, rebuilt } = solidFor(w, mesh.geometry);
        cache.set(key, solid);
        if (rebuilt && solid) report.rebuilt++;
      }
      const base = cache.get(key)!;
      each((mm) => {
        report.pieces++;
        if (!base) { report.skipped.push(mesh.geometry.type); return; }
        metal.push(base.transform(toMat4(mm)));
        report.joined++;
      });
    } else if (opts.seats !== false && !drilled.has(o)) {
      const key = mesh.geometry.uuid;
      if (!seatCache.has(key)) seatCache.set(key, seatCutter(w, mesh.geometry));
      const base = seatCache.get(key);
      if (!base) return;
      each((mm) => {
        const p = new THREE.Vector3().setFromMatrixPosition(mm);
        const id = `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`;
        if (seen.has(id)) return;
        seen.add(id);
        cutters.push(base.transform(toMat4(mm)));
      });
    }
  });

  if (!metal.length) return null;
  let solid = w.Manifold.union(metal);
  metal.forEach((s) => s.delete());
  if (cutters.length) {
    const cut = w.Manifold.union(cutters);
    cutters.forEach((s) => s.delete());
    const seated = solid.subtract(cut);
    cut.delete(); solid.delete();
    solid = seated;
    report.seats = seen.size;
    // Seats for tightly packed stones can nick off a speck of a neighbour's claw; a speck on its own can't be cast,
    // so anything far smaller than the main pieces is dropped and counted.
    const bits = solid.decompose(), vols = bits.map((b) => b.volume()), top = Math.max(...vols);
    const keep = bits.filter((_, i) => vols[i] >= top * 0.002);
    report.specks = bits.length - keep.length;
    if (report.specks) { const kept = w.Manifold.union(keep); solid.delete(); solid = kept; }
    bits.forEach((b) => b.delete());
  }
  cache.forEach((s) => s?.delete());
  seatCache.forEach((s) => s?.delete());
  if (solid.numTri() > 600000) { const lean = solid.simplify(0.01); solid.delete(); solid = lean; }
  report.watertight = solid.status() === "NoError" && !solid.isEmpty();
  report.volumeMm3 = Math.round(solid.volume() * 10) / 10;
  const mesh = solid.getMesh();
  solid.delete();
  const geo = new THREE.BufferGeometry();
  const verts = mesh.vertProperties, stride = mesh.numProp;
  const positions = new Float32Array((verts.length / stride) * 3);
  for (let i = 0, j = 0; i < verts.length; i += stride, j += 3) { positions[j] = verts[i]; positions[j + 1] = verts[i + 1]; positions[j + 2] = verts[i + 2]; }
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setIndex(new THREE.BufferAttribute(Uint32Array.from(mesh.triVerts), 1));
  geo.computeVertexNormals();
  return { geometry: geo, report };
}
