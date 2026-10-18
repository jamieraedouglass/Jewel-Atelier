import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { strToU8, zipSync } from "three/examples/jsm/libs/fflate.module.js";
import { type Design } from "./design";
import { buildPiece } from "./jewelryModel";
import { buildSpec, isMetal } from "./studio/spec";

export type Part = { name: string; metal: boolean; color: string; geos: THREE.BufferGeometry[] };

const plain = (g: THREE.BufferGeometry, m: THREE.Matrix4) => {
  const out = new THREE.BufferGeometry();
  const src = g.index ? g.toNonIndexed() : g;
  out.setAttribute("position", src.getAttribute("position").clone());
  out.applyMatrix4(m);
  if (m.determinant() < 0) {
    const p = out.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i += 3) for (let k = 0; k < 3; k++) { const a = p.getComponent(i + 1, k); p.setComponent(i + 1, k, p.getComponent(i + 2, k)); p.setComponent(i + 2, k, a); }
  }
  out.computeVertexNormals();
  return out;
};

const proxies = new WeakMap<THREE.BufferGeometry, THREE.BufferGeometry>();
const light = (g: THREE.BufferGeometry, metal: boolean) => {
  const tris = (g.index ? g.index.count : g.getAttribute("position").count) / 3;
  if (metal || tris <= 3000) return g;
  if (!proxies.has(g)) {
    g.computeBoundingBox();
    const b = g.boundingBox!, size = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3());
    const dome = new THREE.SphereGeometry(0.5, 24, 12);
    dome.scale(size.x, size.y, size.z).translate(mid.x, mid.y, mid.z);
    proxies.set(g, dome);
  }
  return proxies.get(g)!;
};

export function modelParts(d: Design): Part[] {
  const piece = buildPiece(d);
  const root = piece.group;
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const parts = new Map<string, Part>();
  const m = new THREE.Matrix4();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshPhysicalMaterial;
    if (!mat || (mat.transparent && mat.opacity < 0.5)) return;
    const metal = isMetal(mesh.material);
    let tag = "";
    for (let p: THREE.Object3D | null = o; p && !tag; p = p.parent) tag = (p.userData.part as string) ?? "";
    const name = metal ? "Metal" : `Stones ${tag || "main"} ${mat.color ? `#${mat.color.getHexString()}` : ""}`.trim();
    const part = parts.get(name) ?? parts.set(name, { name, metal, color: metal ? "#d4af37" : `#${mat.color?.getHexString() ?? "ffffff"}`, geos: [] }).get(name)!;
    const inst = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh) : null;
    const geo = light(mesh.geometry, metal);
    if (inst) for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, m); m.premultiply(mesh.matrixWorld); part.geos.push(plain(geo, m)); }
    else part.geos.push(plain(geo, mesh.matrixWorld));
  });
  return [...parts.values()].filter((p) => p.geos.length);
}

const mergedMesh = (p: Part) => new THREE.Mesh(mergeGeometries(p.geos, false) ?? new THREE.BufferGeometry(), new THREE.MeshBasicMaterial());

export function cadZip(d: Design, extra: Record<string, Uint8Array> = {}, given?: Part[]): Uint8Array {
  const parts = given ?? modelParts(d);
  const stl = new STLExporter();
  const metal = parts.filter((p) => p.metal), stones = parts.filter((p) => !p.metal);
  const files: Record<string, Uint8Array> = {};
  const binary = (meshes: THREE.Mesh[]) => {
    const g = new THREE.Group(); meshes.forEach((x) => g.add(x));
    const v = stl.parse(g, { binary: true }) as DataView;
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  };
  if (metal.length) files["metal.stl"] = binary(metal.map(mergedMesh));
  stones.forEach((p) => { files[`${p.name.toLowerCase().replace(/[^\w]+/g, "-").replace(/-+$/, "")}.stl`] = binary([mergedMesh(p)]); });
  const spec = buildSpec(d);
  files["README.txt"] = strToU8([
    `${spec.title}`,
    spec.summary,
    "",
    "Units: millimetres. The model is at real size.",
    "model.3dm      Rhino file (opens in Rhino and MatrixGold): the metal on its own layer, every stone a separate",
    "               named object on a layer per stone type, units millimetres",
    "metal.stl      the metal only, for wax/resin printing and casting",
    "stones-*.stl   each set of stones (by colour), in place. Import them all together to see the whole piece",
    "               (Rhino, MatrixGold, JewelCAD and print software all open STL).",
    "               Small stones are simple domes of the right size, as placeholders for setting.",
    "",
    "Before casting: the metal is made of overlapping parts (band, head, prongs, beads), so union it into one solid",
    "(Rhino: BooleanUnion, or your print software's repair) and check wall and prong thickness for your alloy.",
    "Stone seats are not cut; set the stones to their real sizes from the list below.",
    "",
    ...spec.facts.map(([k, v]) => `${k}: ${v}`),
    `Metal weight (estimate): ${spec.metal.weightG} g`,
    "",
    "Stones:",
    ...spec.stones.map((s) => `  ${s.count} × ${s.what}, ${s.size}${s.totalCt ? `, ≈ ${s.totalCt} ct total` : ""}`),
    "",
    ...spec.notes,
  ].join("\n"));
  return zipSync({ ...extra, ...files }, { level: 6 });
}
