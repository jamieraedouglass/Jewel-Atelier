import * as THREE from "three";
import { STLExporter } from "three/examples/jsm/exporters/STLExporter.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { strToU8, zipSync } from "three/examples/jsm/libs/fflate.module.js";
import { checkBuild, type BuildIssue } from "./buildCheck";
import type { SolidReport, Spot } from "./cadSolid";
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

export type MetalSolid = { geometry: THREE.BufferGeometry; report: SolidReport };

const at = (s: Spot) => `${s.where}, at about (${s.at.join(", ")}) mm`;

// The checks run on the metal solid, written so a jeweller sees first what to fix before casting.
export function checkLines(r: SolidReport | null | undefined, build: BuildIssue[] = [], pieces = 1): string[] {
  const lines: string[] = [];
  const flag = (ok: boolean, text: string, detail: string[] = []) => { lines.push(`${ok ? "OK   " : "CHECK"} ${text}`, ...detail.map((x) => `      ${x}`)); };
  if (!build.length) flag(true, "Stones: none overlap and none are too small to set.");
  for (const issue of build) flag(false, `Stones: ${issue.message}`);
  if (!r) return lines;
  if (r.bodies?.length) {
    // Chain links, jump rings and beads are made and assembled separately; a large piece on its own is a mistake.
    const big = r.bodies[0].mm3 * 0.05;
    const extra = r.bodies.slice(pieces).filter((b) => b.mm3 >= big), small = r.bodies.length - pieces - extra.length;
    const smallNote = small > 0 ? ` Plus ${small} small part${small > 1 ? "s" : ""} (chain links, jump rings, beads) made and assembled separately.` : "";
    flag(!extra.length, extra.length
      ? `One piece: ${extra.length} sizeable part${extra.length > 1 ? "s are" : " is"} separate from the rest of the metal. Cast ${extra.length > 1 ? "them" : "it"} on ${extra.length > 1 ? "their" : "its"} own if ${extra.length > 1 ? "they hang" : "it hangs"} from a jump ring; otherwise join ${extra.length > 1 ? "them" : "it"} on before casting:`
      : `${pieces > 1 ? `One piece: each of the ${pieces} is one piece of metal.` : "One piece: all the metal is joined."}${smallNote}`,
    extra.slice(0, 8).map((s) => `- ${at(s)} (${s.mm3} mm3)`));
  }
  if (r.stones !== undefined) {
    const unseated = r.unseated ?? [], loose = r.loose ?? [];
    flag(!unseated.length, unseated.length
      ? `Seats: ${unseated.length} of ${r.stones} stones have no seat cut; cut these by hand:`
      : `Seats: all ${r.stones} set stones have a seat cut${r.strung ? ` (${r.strung} drilled stones are strung on wire and need none)` : ""}.`,
    unseated.slice(0, 12).map((s) => `- ${at(s)}`));
    flag(!loose.length, loose.length ? `Holding: ${loose.length} stone(s) don't touch any metal, so nothing holds them:` : "Holding: every stone sits against metal.", loose.slice(0, 12).map((s) => `- ${at(s)}`));
  }
  const t = r.thin;
  if (t) {
    if (!t.spots.length) flag(true, `Thickness: no metal thinner than ${t.minMm} mm found.`);
    else {
      const parts = new Map<string, { area: number; typ: number[] }>();
      for (const sp of t.spots) { const p = parts.get(sp.where) ?? parts.set(sp.where, { area: 0, typ: [] }).get(sp.where)!; p.area += sp.areaMm2; p.typ.push(sp.typicalMm); }
      const share = t.surfaceMm2 ? Math.round((t.thinMm2 / t.surfaceMm2) * 100) : 0;
      flag(false, `Thickness: about ${share}% of the metal surface is thinner than ${t.minMm} mm, which may not fill in casting or may bend in wear.`, [
        ...[...parts.entries()].sort((a, b) => b[1].area - a[1].area).map(([where, p]) => {
          const typ = p.typ.sort((a, b) => a - b)[p.typ.length >> 1];
          return `- ${where}: ${Math.round(p.area)} mm2, typically ${typ} mm thick`;
        }),
        "Thinnest spots:",
        ...t.spots.slice(0, 8).map((sp) => `- ${at(sp)}: about ${sp.typicalMm} mm`),
        "Thicken these (prongs and claws to about 0.8 mm, walls to at least 0.6 mm) or confirm they suit your casting.",
        "Fine milgrain and beading is often added by hand after casting instead.",
      ]);
    }
  }
  return lines;
}

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
  const checks = checkLines(r, checkBuild(d, pieceRoot(d)), d.type === "earrings" ? 2 : 1);
  const solidLines = r ? [
    r.watertight && !r.skipped.length
      ? `metal.stl is ONE watertight solid: all ${r.joined} metal parts joined, with ${r.seats} stone seats cut (matched to each stone below its girdle, about 0.05 mm clearance).`
      : `metal.stl is a solid made from ${r.joined} of ${r.pieces} metal parts${r.skipped.length ? `; ${r.skipped.length} part(s) couldn't be joined and are in metal-unjoined-parts.stl` : ""}. Check it before casting.`,
    ...(r.specks ? [`${r.specks} tiny fragment(s) of claw tips between tightly packed stones were left over after cutting seats and removed; set those stones on shared prongs.`] : []),
    `Metal volume ${r.volumeMm3} mm3, so the metal weighs about ${Math.round((r.volumeMm3 / 1000) * density * 100) / 100} g in ${spec.metal.name} (density ${density} g/cm3).`,
  ] : ["metal.stl is the metal parts as modelled (overlapping, not yet joined). Union them into one solid before casting."];
  files["README.txt"] = strToU8([
    `${spec.title}`,
    spec.summary,
    "",
    ...(checks.length ? ["CHECKS BEFORE CASTING (automatic; a CAD jeweller should still review the model)", ...checks, ""] : []),
    "Units: millimetres. The model is at real size.",
    "model.3dm      Rhino file (opens in Rhino and MatrixGold): the metal on its own layer, every stone a separate",
    "               named object on a layer per stone type, units millimetres",
    "metal.stl      the metal only, for wax/resin printing and casting",
    "stones-*.stl   each set of stones (by colour), in place. Import them all together to see the whole piece",
    "               (Rhino, MatrixGold, JewelCAD and print software all open STL).",
    "               Small stones are simple domes of the right size, as placeholders for setting.",
    "",
    ...solidLines,
    ...(d.type === "earrings" && (((d.style === "pendant" || d.style === "chandelier") && d.drop.top === "post") || (d.style === "freeform" && d.freeform.top === "post"))
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
