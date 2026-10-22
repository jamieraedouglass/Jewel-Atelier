import * as THREE from "three";
import { type Design } from "../design";

const METAL_BASE: Record<Design["metal"], { color: number; roughness: number }> = {
  "yellow-gold": { color: 0xe6c27a, roughness: 0.22 },
  "rose-gold": { color: 0xe7ac90, roughness: 0.22 },
  "white-gold": { color: 0xd6d5d1, roughness: 0.24 },
  platinum: { color: 0xcdd0d4, roughness: 0.2 },
  "oxidised-silver": { color: 0x3b3936, roughness: 0.5 },
};
export function metalTone(d: Pick<Design, "metal" | "purity">) {
  const base = METAL_BASE[d.metal];
  if (d.metal !== "yellow-gold" && d.metal !== "rose-gold") return base;
  const target = d.metal === "yellow-gold" ? 0xf2b13c : 0xeb9c70;
  const k = { 14: -0.25, 18: 0, 22: 0.6, 24: 0.9 }[d.purity.karat as 14 | 18 | 22 | 24] ?? 0;
  const c = new THREE.Color(base.color);
  if (k >= 0) c.lerp(new THREE.Color(target), k); else c.lerp(new THREE.Color(0xe0d2a8), -k);
  return { color: c.getHex(), roughness: base.roughness };
}

export function textureBump() {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512; c.height = 64;
  const x = c.getContext("2d")!;
  x.fillStyle = "#808080"; x.fillRect(0, 0, 512, 64);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + Math.random() * 120;
    x.fillStyle = `rgb(${v},${v},${v})`;
    x.fillRect(Math.random() * 512, Math.random() * 64, 1 + Math.random() * 3, 1 + Math.random() * 2);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
