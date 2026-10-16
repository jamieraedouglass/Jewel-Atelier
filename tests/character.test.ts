import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { DIAMOND_GRADES, applyPatch, characterNotes, defaultDesign, describeDesign, diamondGrade, inclusionWords, normalizeDesign } from "@/lib/design";
import { isColorless } from "@/lib/jewelry/stones";
import { buildSpec } from "@/lib/studio/spec";

const ring = () => normalizeDesign({ ...defaultDesign(), type: "ring", style: "solitaire" });
const find = async (d: ReturnType<typeof defaultDesign>) => {
  const { buildPiece } = await import("@/lib/jewelryModel");
  const out = { star: 0, specks: 0, tints: [] as string[] };
  buildPiece(d).group.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh && (m.material as THREE.ShaderMaterial).isShaderMaterial) out.star++;
    if ((m as unknown as THREE.InstancedMesh).isInstancedMesh && (m.material as THREE.MeshBasicMaterial).depthTest === false) out.specks += (m as unknown as THREE.InstancedMesh).count;
    if (m.userData?.tint) out.tints.push(m.userData.tint);
  });
  return out;
};

describe("a stone's character", () => {
  it("is off by default, so existing designs look the same", async () => {
    const d = ring();
    expect(d.center).toMatchObject({ inclusions: 0, phenomenon: "none", rays: 6, colorGrade: null });
    expect(await find(d)).toEqual({ star: 0, specks: 0, tints: [] });
  });
  it("draws a star sapphire's star, and names it", async () => {
    const d = applyPatch(ring(), { center: { gem: "sapphire", cut: "cabochon", color: "#4a5a8c", clarity: 0.3, phenomenon: "star", rays: 6, domeMm: 3 } });
    expect((await find(d)).star).toBe(1);
    const pendant = normalizeDesign({ ...defaultDesign(), type: "necklace", style: "pendant" });
    expect((await find(applyPatch(pendant, { center: { gem: "sapphire", cut: "cabochon", phenomenon: "star", domeMm: 3 } }))).star).toBe(1);
    expect(describeDesign(d)).toMatch(/6-ray star sapphire cabochon/);
    expect(characterNotes(d.center)).toContain("6-ray star");
  });
  it("only shows a star on a cabochon", async () => {
    expect((await find(applyPatch(ring(), { center: { phenomenon: "star" } }))).star).toBe(0); // faceted
  });
  it("draws more inclusions the more included the stone", async () => {
    const few = (await find(applyPatch(ring(), { center: { inclusions: 0.2 } }))).specks;
    const many = (await find(applyPatch(ring(), { center: { inclusions: 0.9 } }))).specks;
    expect(few).toBeGreaterThan(0);
    expect(many).toBeGreaterThan(few);
    expect(inclusionWords(0)).toBe("eye-clean");
    expect(inclusionWords(0.9)).toBe("heavily included");
  });
  it("keeps a faintly yellow diamond a diamond, with its warmth", async () => {
    for (const g of DIAMOND_GRADES.slice(0, 4)) expect(isColorless("diamond", g.color), g.id).toBe(true);
    // a pendant's stone carries its tint to the traced pass (a ring's takes it from the stone's own colour)
    const pendant = normalizeDesign({ ...defaultDesign(), type: "necklace", style: "pendant", center: { ...defaultDesign().center, gem: "diamond", cut: "faceted" } });
    expect((await find(applyPatch(pendant, { center: { color: diamondGrade("D-F")!.color } }))).tints).toEqual([]);
    expect((await find(applyPatch(pendant, { center: { color: diamondGrade("K-M")!.color, colorGrade: "K-M" } }))).tints).toEqual([diamondGrade("K-M")!.color]);
  });
  it("goes on the workshop sheet", () => {
    const d = applyPatch(ring(), { center: { colorGrade: "G-J", color: diamondGrade("G-J")!.color, inclusions: 0.3 } });
    expect(buildSpec(d).notes.join(" ")).toMatch(/g–j near colourless · lightly included/);
  });
  it("survives a stored design that predates it", () => {
    const old = { ...defaultDesign(), center: { gem: "ruby", cut: "cabochon", shape: "oval", lengthMm: 8, widthMm: 6, domeMm: 3, color: "#9b111e", clarity: 0.4, label: "Ruby" } };
    expect(normalizeDesign(old).center).toMatchObject({ gem: "ruby", inclusions: 0, phenomenon: "none" });
  });
});
