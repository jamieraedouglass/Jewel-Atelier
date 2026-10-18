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

export function pieceRoot(d: Design) {
  const root = buildPiece(d).group;
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  return root;
}

export function modelParts(d: Design, given?: THREE.Object3D): Part[] {
  const root = given ?? buildPiece(d).group;
  root.position.set(0, 0, 0); root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
  root.updateMatrixWorld(true);
  const parts = new Map<string, Part>();
  const m = new THREE.Matrix4();
  const findings = new Set<THREE.Object3D>();
  root.traverse((o) => { if (o.userData.finding) o.traverse((k) => findings.add(k)); });
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || findings.has(o)) return;
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

export type MetalSolid = { geometry: THREE.BufferGeometry; report: { pieces: number; joined: number; skipped: string[]; seats: number; specks?: number; watertight: boolean; volumeMm3: number } };

export function cadZip(d: Design, extra: Record<string, Uint8Array> = {}, given?: Part[], solid?: MetalSolid | null): Uint8Array {
  const parts = given ?? modelParts(d);
  const stl = new STLExporter();
  const metal = parts.filter((p) => p.metal), stones = parts.filter((p) => !p.metal);
  const files: Record<string, Uint8Array> = {};
  const binary = (meshes: THREE.Mesh[]) => {
    const g = new THREE.Group(); meshes.forEach((x) => g.add(x));
    const v = stl.parse(g, { binary: true }) as DataView;
    return new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  };
  if (solid) {
    files["metal.stl"] = binary([new THREE.Mesh(solid.geometry, new THREE.MeshBasicMaterial())]);
    if (!solid.report.watertight || solid.report.skipped.length) files["metal-unjoined-parts.stl"] = binary(metal.map(mergedMesh));
  } else if (metal.length) files["metal.stl"] = binary(metal.map(mergedMesh));
  stones.forEach((p) => { files[`${p.name.toLowerCase().replace(/[^\w]+/g, "-").replace(/-+$/, "")}.stl`] = binary([mergedMesh(p)]); });
  const spec = buildSpec(d);
  const density = spec.metal.density;
  const r = solid?.report;
  const solidLines = r ? [
    r.watertight && !r.skipped.length
      ? `metal.stl is ONE watertight solid: all ${r.joined} metal parts joined, with a seat cut for each of the ${r.seats} stones (matched to each stone below its girdle, about 0.05 mm clearance).`
      : `metal.stl is a solid made from ${r.joined} of ${r.pieces} metal parts${r.skipped.length ? `; ${r.skipped.length} part(s) couldn't be joined and are in metal-unjoined-parts.stl` : ""}. Check it before casting.`,
    ...(r.specks ? [`${r.specks} tiny fragment(s) of claw tips between tightly packed stones were left over after cutting seats and removed; set those stones on shared prongs.`] : []),
    `Metal volume ${r.volumeMm3} mm3, so the metal weighs about ${Math.round((r.volumeMm3 / 1000) * density * 100) / 100} g in ${spec.metal.name} (density ${density} g/cm3).`,
  ] : ["metal.stl is the metal parts as modelled (overlapping, not yet joined). Union them into one solid before casting."];
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
    ...solidLines,
    ...(d.type === "earrings" && (d.style === "pendant" || d.style === "chandelier") && d.drop.top === "post"
      ? ["Each earring has a 0.85 mm post on a pad behind the top stone (part of metal.stl). The butterfly backs are standard", "findings, not modelled for casting: buy them to fit the post."]
      : []),
    "Before casting: check wall and prong thickness for your alloy and casting method, add sprues, and confirm the",
    "ring size against the inside diameter. Measure your actual stones and adjust seats if they differ from the list.",
    "",
    ...spec.facts.map(([k, v]) => `${k}: ${v}`),
    ...(r ? [] : [`Metal weight (estimate): ${spec.metal.weightG} g`]),
    "",
    "Stones:",
    ...spec.stones.map((s) => `  ${s.count} × ${s.what}, ${s.size}${s.totalCt ? `, ≈ ${s.totalCt} ct total` : ""}`),
    "",
    ...spec.notes,
  ].join("\n"));
  return zipSync({ ...extra, ...files }, { level: 6 });
}
