import * as THREE from "three";
import {
  STYLES, TYPE_LABEL, caratFromDims, characterNotes, describeDesign, shownPhenomenon, gemLabel, indianRingSize, isSolidBracelet, label, metalName, uses,
  type CenterStone, type Design,
} from "../design";
import { sizeText } from "./links";
import { buildPiece } from "../jewelryModel";
import { disposeGroup } from "../ringModel";
import { type LaidStone, layoutFreeform } from "../freeform/layout";

export function metalDensity(d: Pick<Design, "metal" | "purity">) {
  if (d.metal === "platinum") return 21.4;
  if (d.metal === "oxidised-silver") return 10.4;
  const byKarat: Record<number, number> = { 14: 13.1, 18: 15.6, 22: 17.8, 24: 19.3 };
  const base = byKarat[d.purity.karat] ?? 15.6;
  return d.metal === "white-gold" ? base + 0.3 : d.metal === "rose-gold" ? base - 0.4 : base;
}

function closedVolume(g: THREE.BufferGeometry) {
  const pos = g.getAttribute("position");
  if (!pos) return 0;
  const idx = g.getIndex();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  let v = 0;
  const tri = (i: number, j: number, k: number) => { a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, j); c.fromBufferAttribute(pos, k); v += a.dot(b.cross(c)) / 6; };
  if (idx) for (let t = 0; t < idx.count; t += 3) tri(idx.getX(t), idx.getX(t + 1), idx.getX(t + 2));
  else for (let t = 0; t < pos.count; t += 3) tri(t, t + 1, t + 2);
  return Math.abs(v);
}

export function geometryVolume(g: THREE.BufferGeometry) {
  const p = (g as THREE.BufferGeometry & { parameters?: Record<string, unknown> }).parameters;
  if (g.type === "TubeGeometry" && p) return Math.PI * (p.radius as number) ** 2 * (p.path as THREE.Curve<THREE.Vector3>).getLength();
  if (g.type === "CylinderGeometry" && p?.openEnded) return 0;
  return closedVolume(g);
}

export const isMetal = (m: THREE.Material | THREE.Material[]) => {
  const mat = (Array.isArray(m) ? m[0] : m) as THREE.MeshPhysicalMaterial;
  return !!mat && mat.metalness >= 0.9 && !mat.flatShading;
};

function metalWeight(group: THREE.Object3D, density: number) {
  group.updateMatrixWorld(true);
  const m = new THREE.Matrix4();
  let mm3 = 0;
  group.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !isMetal(mesh.material)) return;
    const v = geometryVolume(mesh.geometry);
    if (!v) return;
    const inst = (o as THREE.InstancedMesh).isInstancedMesh ? (o as THREE.InstancedMesh) : null;
    if (inst) for (let i = 0; i < inst.count; i++) { inst.getMatrixAt(i, m); m.premultiply(mesh.matrixWorld); mm3 += v * Math.abs(m.determinant()); }
    else mm3 += v * Math.abs(mesh.matrixWorld.determinant());
  });
  return Math.round(((mm3 / 1000) * density) * 10) / 10;
}

type StoneLine = { what: string; count: number; size: string; eachCt: number | null; totalCt: number | null };

function smallStones(group: THREE.Object3D): { count: number; diaMm: number }[] {
  const bySize = new Map<number, number>();
  const s = new THREE.Vector3(), q = new THREE.Quaternion(), p = new THREE.Vector3(), m = new THREE.Matrix4();
  group.updateMatrixWorld(true);
  group.traverse((o) => {
    if (o.userData.part !== "accents") return;
    const first = o.children[0] as THREE.InstancedMesh | undefined;
    if (!first?.isInstancedMesh) return;
    for (let i = 0; i < first.count; i++) {
      first.getMatrixAt(i, m); m.premultiply(first.matrixWorld); m.decompose(p, q, s);
      const dia = Math.round(Math.min(s.x, s.z) * 10) / 10;
      bySize.set(dia, (bySize.get(dia) ?? 0) + 1);
    }
  });
  return [...bySize].sort((a, b) => b[0] - a[0]).map(([diaMm, count]) => ({ count, diaMm }));
}

const ct = (c: Pick<CenterStone, "gem" | "cut" | "shape" | "lengthMm" | "widthMm" | "carat">) => c.carat ?? caratFromDims(c.gem, c.cut, c.shape, c.lengthMm, c.widthMm);
const r2 = (n: number) => Math.round(n * 100) / 100;
const cutName = (c: Pick<CenterStone, "cut" | "shape">) => (c.cut === "faceted" ? `${label(c.shape).toLowerCase()} cut` : `${label(c.shape).toLowerCase()} ${c.cut}`);

export type Spec = {
  title: string; summary: string;
  facts: [string, string][];
  stones: StoneLine[];
  metal: { name: string; weightG: number; density: number };
  notes: string[];
};

export function buildSpec(d: Design): Spec {
  const pair = d.type === "earrings" ? 2 : 1;
  const stones: StoneLine[] = [];
  const line = (what: string, count: number, c: Pick<CenterStone, "gem" | "cut" | "shape" | "lengthMm" | "widthMm" | "carat"> & { label?: string }, estimated = true) => {
    const each = ct(c);
    stones.push({ what: `${what}: ${c.label || gemLabel(c.gem)} · ${cutName(c)}`, count, size: `${sizeText(c)} mm`, eachCt: each, totalCt: r2(each * count) });
    void estimated;
  };
  if (uses(d, "center") && !d.center.none) line(d.type === "ring" ? "Centre stone" : "Main stone", pair, d.center);
  for (const e of d.extraStones) if (uses(d, "extraStones")) line(d.type === "ring" ? "Second stone" : "Stone", pair, { ...e, carat: null });
  if (uses(d, "drop")) d.drop.parts.forEach((part, i) => {
    const twin = part.pair ? 2 : 1;
    if (part.showStone || part.kind === "stone") line(`Part ${i + 1}`, pair * twin, { ...part.stone, carat: null });
    const small = part.kind === "strands" ? part.count * part.perStrand : part.kind === "stone" ? part.count : 0;
    if (small) line(`Part ${i + 1} small stones`, small * pair * twin, { gem: part.small.gem, cut: part.small.cut, shape: part.small.shapes[0], lengthMm: part.small.widthMm, widthMm: part.small.widthMm, carat: null });
  });

  const piece = buildPiece(d);
  const density = metalDensity(d);
  const weightG = metalWeight(piece.group, density);
  if (d.style === "freeform") {
    // A unique piece lists its stones from its own layout: each gem, cut, shape and size, counted exactly.
    const tally = new Map<string, { s: LaidStone; count: number }>();
    for (const s of layoutFreeform(d.freeform).stones) {
      const L = Math.round(s.L * 10) / 10, W = Math.round(s.W * 10) / 10, key = `${s.gem}|${s.cut}|${s.shape}|${L}|${W}|${s.big}`;
      const t = tally.get(key) ?? tally.set(key, { s: { ...s, L, W }, count: 0 }).get(key)!;
      t.count++;
    }
    for (const { s, count } of [...tally.values()].sort((a, b) => b.s.L * b.s.W - a.s.L * a.s.W)) {
      line(s.big ? "Stone" : "Set stones", count * pair, { gem: s.gem, cut: s.cut, shape: s.shape, lengthMm: s.L, widthMm: s.W, carat: null });
    }
    const n = d.freeform.neckline;
    if (d.type === "necklace" && n.kind === "stones") {
      const count = Math.round((d.options.lengthIn * 25.4 * 0.97) / (n.sizeMm + 0.18)) * n.rows;
      line("Neckline stones (≈ count)", count, { gem: n.gem, cut: n.cut, shape: n.shape, lengthMm: n.sizeMm, widthMm: n.sizeMm, carat: null });
    }
  } else for (const { count, diaMm } of smallStones(piece.group)) {
    const each = caratFromDims(d.accents.gem, "faceted", "round", diaMm, diaMm);
    stones.push({ what: `Accent stones: ${gemLabel(d.accents.gem)}`, count, size: `≈ ${diaMm} mm`, eachCt: each, totalCt: r2(each * count) });
  }
  disposeGroup(piece.group);

  const facts: [string, string][] = [
    ["Piece", `${TYPE_LABEL[d.type]} · ${STYLES[d.type][d.style]?.label ?? d.style}`],
    ["Metal", metalName(d)],
  ];
  if (d.type === "ring") facts.push(["Ring size", `US ${d.ringSize} · Indian ${indianRingSize(d.ringSize)}`], ["Band", `${d.band.widthMm} mm · ${d.band.shape} · ${d.band.finish} · ${d.band.profile}`]);
  if (d.type === "bracelet") facts.push(isSolidBracelet(d) ? ["Bangle size", d.options.bangleSize] : ["Wrist", `${d.options.wristCm} cm`]);
  if (d.type === "necklace") facts.push(["Length", `${d.options.lengthIn}" (${Math.round(d.options.lengthIn * 2.54)} cm)`]);
  if (uses(d, "setting")) facts.push(["Setting", label(d.setting.style)]);
  if (d.type === "earrings") facts.push(["Pair", d.rightEar ? "Left and right differ" : d.mirrorPair ? "Matching, mirrored" : "Matching"]);

  const notes: string[] = [];
  if (d.style === "freeform" && d.freeform.notes) notes.push(`${d.freeform.name}: ${d.freeform.notes}`);
  if (d.mood) notes.push(`The feel the client wants: ${d.mood}.`);
  if (d.enamel.enabled && uses(d, "enamel")) notes.push(`Meenakari enamel, colour ${d.enamel.color}.`);
  if (d.fringe.enabled && uses(d, "fringe")) notes.push(`${gemLabel(d.fringe.gem)} fringe beads, ${d.fringe.sizeMm} mm.`);
  if (d.type === "ring" && d.gallery.roseCut) notes.push(d.gallery.under === "hidden-halo" ? "Hidden halo of small rose-cuts round the gallery." : "Two rose-cut diamonds peeking out of the gallery.");
  if (d.center.glow > 0) notes.push("Centre stone chosen for its glow (strong fluorescence and saturation): confirm the stone in daylight.");
  if (uses(d, "center") && !d.center.none) {
    const character = characterNotes(d.center);
    if (character.length) notes.push(`Centre stone: ${character.join(" · ").toLowerCase()}${shownPhenomenon(d.center) !== "none" ? " (orient the stone so the star or band sits centred under the light)" : ""}.`);
  }
  notes.push("Stone weights marked ≈ are estimated from their size; metal weight is estimated from the 3D model. Confirm both before quoting.");

  return { title: d.name, summary: describeDesign(d), facts, stones, metal: { name: metalName(d), weightG, density }, notes };
}
