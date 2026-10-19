import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import Module from "manifold-3d";
import { MeshBVH } from "three-mesh-bvh";
import { isMetal } from "./studio/spec";

type Wasm = Awaited<ReturnType<typeof Module>>;
type Solid = InstanceType<Wasm["Manifold"]>;
let loading: Promise<Wasm> | null = null;
const engine = () => (loading ??= Module().then((w) => { w.setup(); return w; }));

// A spot on the piece, named by the part it's on and placed in millimetres, so a CAD jeweller can find it.
export type Spot = { where: string; at: [number, number, number] };
export type ThinSpot = Spot & { typicalMm: number; areaMm2: number };
export type ThinCheck = { minMm: number; spots: ThinSpot[]; thinMm2: number; surfaceMm2: number };
export type SolidReport = {
  pieces: number; joined: number; rebuilt: number; skipped: string[]; seats: number; specks?: number; watertight: boolean; volumeMm3: number;
  // Checks before casting: every stone that needs a seat has one and touches the metal, and no metal is too thin to cast.
  stones?: number; strung?: number; unseated?: Spot[]; loose?: Spot[]; thin?: ThinCheck;
};

// Metal thinner than this is at risk of not filling in casting, or of bending or breaking in wear.
export const THIN_MM = 0.6;

const PART_NAMES: Record<string, string> = {
  center: "the centre stone's setting", sides: "the side stones' settings", extra: "the second stone's setting", accents: "the small stones' settings",
  motif: "the motif", band: "the band", head: "the centre stone's head and gallery", fringe: "the fringe",
};
const partOf = (o: THREE.Object3D) => {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) {
    if (p.userData.shank) return "band";
    if (typeof p.userData.part === "string" && p.userData.part) return p.userData.part as string;
    // A ring's own root (it knows its girdle height): metal right under it, outside any named part, is the head.
    if (typeof p.userData.girdleY === "number") return "head";
  }
  return "";
};
const nameOf = (part: string) => PART_NAMES[part] ?? (part ? `the ${part}` : "the frame and links");
const mm1 = (v: THREE.Vector3): [number, number, number] => [Math.round(v.x * 10) / 10, Math.round(v.y * 10) / 10, Math.round(v.z * 10) / 10];

// Wall thickness the way CAD checks measure it: from points spread over the surface, straight in along the inward
// normal to where the ray leaves the metal again. Thin points close together are gathered into one spot, which reports
// its typical (median) thickness: single readings right beside a sharp edge or a claw tip run near zero and mean little.
export function thinSpots(geo: THREE.BufferGeometry, minMm: number, partAt: (p: THREE.Vector3) => string, samples = 40000): ThinCheck {
  const pos = geo.getAttribute("position"), index = geo.index;
  const tris = index ? index.count / 3 : pos.count / 3;
  const out: ThinCheck = { minMm, spots: [], thinMm2: 0, surfaceMm2: 0 };
  if (!tris) return out;
  // The BVH reorders the triangles of the geometry it's built on, so it gets its own copy.
  const bvh = new MeshBVH(geo.clone());
  const step = Math.max(1, Math.floor(tris / samples));
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), mid = new THREE.Vector3();
  const ray = new THREE.Ray();
  const cells = new Map<string, { sum: THREE.Vector3; ts: number[]; area: number }>();
  const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  for (let t = 0; t < tris; t += step) {
    a.fromBufferAttribute(pos, vi(t, 0)); b.fromBufferAttribute(pos, vi(t, 1)); c.fromBufferAttribute(pos, vi(t, 2));
    n.subVectors(b, a).cross(c.clone().sub(a));
    const area = n.length() / 2;
    if (area < 1e-6) continue;
    out.surfaceMm2 += area * step;
    n.normalize();
    mid.copy(a).add(b).add(c).divideScalar(3);
    ray.origin.copy(mid).addScaledVector(n, -1e-3);
    ray.direction.copy(n).negate();
    // Hits right at the start are the neighbouring face at a sharp edge, not the far wall.
    const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0.02, minMm);
    if (!hit || hit.distance >= minMm) continue;
    const key = `${Math.round(mid.x / 1.5)},${Math.round(mid.y / 1.5)},${Math.round(mid.z / 1.5)}`;
    const cell = cells.get(key) ?? cells.set(key, { sum: new THREE.Vector3(), ts: [], area: 0 }).get(key)!;
    cell.sum.add(mid); cell.ts.push(hit.distance); cell.area += area * step;
    out.thinMm2 += area * step;
  }
  // A few stray hits (along a crease, say) aren't a thin area: keep spots with some surface to them.
  out.spots = [...cells.values()].filter((x) => x.area >= 0.25).map((x) => {
    const at = x.sum.divideScalar(x.ts.length), ts = x.ts.sort((p, q) => p - q);
    return { where: nameOf(partAt(at)), at: mm1(at), typicalMm: Math.round(ts[ts.length >> 1] * 100) / 100, areaMm2: Math.round(x.area * 10) / 10 };
  }).sort((p, q) => p.typicalMm - q.typicalMm || q.areaMm2 - p.areaMm2);
  out.thinMm2 = Math.round(out.thinMm2);
  out.surfaceMm2 = Math.round(out.surfaceMm2);
  return out;
}

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
  const report: SolidReport = { pieces: 0, joined: 0, rebuilt: 0, skipped: [], seats: 0, specks: 0, watertight: false, volumeMm3: 0, stones: 0, strung: 0, unseated: [], loose: [] };
  // Where each metal part sits, to check every stone touches some metal and to name the part a thin spot is on.
  const metalBoxes: { box: THREE.Box3; part: string }[] = [];
  const boxOf = (s: Solid) => { const bb = s.boundingBox(); return new THREE.Box3(new THREE.Vector3(...bb.min), new THREE.Vector3(...bb.max)); };
  const m = new THREE.Matrix4(), rel = new THREE.Matrix4();
  const seen = new Set<string>();
  const stoneBoxes: { box: THREE.Box3; spot: Spot }[] = [];

  const findings = new Set<THREE.Object3D>(), drilled = new Set<THREE.Object3D>(), openBack = new Map<THREE.Object3D, number>();
  root.traverse((o) => {
    if (o.userData.finding) o.traverse((k) => findings.add(k));
    if (o.userData.strung) o.traverse((k) => drilled.add(k));
    if (typeof o.userData.openBack === "number") o.traverse((k) => openBack.set(k, o.userData.openBack));
  });
  // A light hole straight through the metal behind a stone in an open-backed cell.
  const unitHole = w.Manifold.cylinder(1, 1, 1, 18, false);
  const holeFor = (mm: THREE.Matrix4, geo: THREE.BufferGeometry, frac: number) => {
    geo.computeBoundingBox();
    const b = geo.boundingBox!, pos = new THREE.Vector3(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    mm.decompose(pos, q, sc);
    const r = Math.min(Math.abs(sc.x) * (b.max.x - b.min.x), Math.abs(sc.z) * (b.max.z - b.min.z)) * 0.5 * frac;
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q), base = pos.clone().addScaledVector(up, b.min.y * Math.abs(sc.y) - 2.4);
    const m4 = new THREE.Matrix4().compose(base, new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), up), new THREE.Vector3(r, r, 2.6));
    return unitHole.transform(toMat4(m4));
  };
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
      // Milgrain grains sit on a wire soldered to the metal; in the solid each grain reaches a little deeper so it
      // joins the metal under it instead of floating a hair above a curved surface.
      const grain = inst && mesh.geometry.type === "SphereGeometry";
      const deeper = new THREE.Matrix4().makeScale(1.45, 1.45, 1.45);
      each((mm) => {
        report.pieces++;
        if (!base) { report.skipped.push(mesh.geometry.type); return; }
        const placed = base.transform(toMat4(grain ? mm.clone().multiply(deeper) : mm));
        metal.push(placed);
        metalBoxes.push({ box: boxOf(placed), part: partOf(o) });
        report.joined++;
      });
    } else if (opts.seats !== false && drilled.has(o)) {
      each(() => { report.strung!++; });
    } else if (opts.seats !== false) {
      const key = mesh.geometry.uuid;
      if (!seatCache.has(key)) seatCache.set(key, seatCutter(w, mesh.geometry));
      const base = seatCache.get(key);
      const frac = openBack.get(o);
      each((mm) => {
        // A stone drawn twice (its sparkle and its body) is seated once; matched on its whole placement, not just its
        // position, since stones bent along the band are all placed at the ring's centre and turned to their side.
        const id = `${mesh.geometry.uuid}:${mm.elements.map((v) => v.toFixed(2)).join(",")}`;
        if (seen.has(id)) return;
        seen.add(id);
        report.stones!++;
        const at = mm1(new THREE.Vector3().setFromMatrixPosition(mm)), where = nameOf(partOf(o));
        if (!base) { report.unseated!.push({ where, at }); return; }
        const cutter = base.transform(toMat4(mm));
        cutters.push(cutter);
        stoneBoxes.push({ box: boxOf(cutter), spot: { where, at } });
        if (frac) cutters.push(holeFor(mm, mesh.geometry, frac));
      });
    }
  });

  if (!metal.length) return null;
  // A stone whose seat reaches no metal at all would fall out: nothing holds it.
  for (const s of stoneBoxes) if (!metalBoxes.some((m) => m.box.intersectsBox(s.box))) report.loose!.push(s.spot);
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
  unitHole.delete();
  cache.forEach((s) => s?.delete());
  seatCache.forEach((s) => s?.delete());
  if (solid.numTri() > 600000) { const lean = solid.simplify(0.01); solid.delete(); solid = lean; }
  // Simplifying can leave slivers of its own; anything that small on its own can't be cast.
  {
    const bits = solid.decompose(), vols = bits.map((b) => b.volume()), top = Math.max(...vols, 0);
    const keep = bits.filter((_, i) => vols[i] >= Math.max(top * 0.002, 0.05));
    if (keep.length < bits.length) { report.specks = (report.specks ?? 0) + bits.length - keep.length; const kept = w.Manifold.union(keep); solid.delete(); solid = kept; }
    bits.forEach((b) => b.delete());
  }
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
  const partAt = (p: THREE.Vector3) => {
    let best = "", size = Infinity;
    for (const m of metalBoxes) if (m.box.containsPoint(p)) { const v = m.box.getSize(new THREE.Vector3()); const vol = v.x * v.y * v.z; if (vol < size) { size = vol; best = m.part; } }
    return best;
  };
  report.thin = thinSpots(geo, THIN_MM, partAt);
  return { geometry: geo, report };
}
