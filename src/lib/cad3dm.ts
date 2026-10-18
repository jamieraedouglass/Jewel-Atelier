import "server-only";
import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Part } from "./cadExport";

type Rhino = Awaited<ReturnType<typeof import("rhino3dm")["default"]>>;
let loading: Promise<Rhino> | null = null;
const rhino = () => (loading ??= import("rhino3dm").then((m) => (m.default as unknown as () => Promise<Rhino>)()));

function toMesh(r: Rhino, g: THREE.BufferGeometry) {
  const welded = mergeVertices(g.index ? g : (() => { const x = new THREE.BufferGeometry(); x.setAttribute("position", g.getAttribute("position")); return x; })(), 1e-4);
  const p = welded.getAttribute("position"), idx = welded.index!;
  const mesh = new r.Mesh(), v = mesh.vertices(), f = mesh.faces();
  for (let i = 0; i < p.count; i++) v.add(p.getX(i), p.getY(i), p.getZ(i));
  for (let i = 0; i < idx.count; i += 3) f.addTriFace(idx.getX(i), idx.getX(i + 1), idx.getX(i + 2));
  mesh.normals().computeNormals();
  mesh.compact();
  return mesh;
}

const rgba = (hex: string) => { const c = new THREE.Color(hex); return { r: Math.round(c.r * 255), g: Math.round(c.g * 255), b: Math.round(c.b * 255), a: 255 }; };

export async function rhinoFile(parts: Part[], title: string): Promise<Uint8Array> {
  const r = await rhino();
  const file = new r.File3dm();
  file.settings().modelUnitSystem = r.UnitSystem.Millimeters;
  file.applicationName = "Jewel Atelier";
  file.startSectionComments = title;
  parts.forEach((part, li) => {
    const layer = new r.Layer();
    layer.name = part.metal ? "Metal" : part.name.replace(/[^\w #-]+/g, " ");
    layer.color = rgba(part.color);
    file.layers().add(layer);
    const attrs = (name: string) => { const a = new r.ObjectAttributes(); a.layerIndex = li; a.name = name; return a; };
    if (part.metal) {
      const merged = mergeGeometries(part.geos, false);
      if (merged) file.objects().add(toMesh(r, merged), attrs("Metal (union before casting)"));
    } else part.geos.forEach((g, i) => file.objects().add(toMesh(r, g), attrs(`${layer.name} ${i + 1}`)));
  });
  return file.toByteArray();
}
