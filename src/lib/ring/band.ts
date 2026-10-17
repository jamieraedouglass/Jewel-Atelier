import * as THREE from "three";
import { type Design } from "../design";

export function bandSection(width: number, th: number, top?: { topW: number; topT: number; spread: number; round?: boolean }, shape: Design["band"]["shape"] = "classic", rin = 8.5) {
  let tp: number, tpW: number;
  const ease = (a: number, t0: number, t1: number) => { const x = Math.min(1, Math.max(0, (a - t0) / (t1 - t0))); return 1 - x * x * (3 - 2 * x); };
  if (top) {
    const aEnd = top.spread / (rin + 2.2);
    const a = Math.abs(Math.atan2(Math.sin(th), Math.cos(th)));
    tp = ease(a, aEnd * 0.8, aEnd * 1.08);
    tpW = ease(a, aEnd * 0.55, aEnd * 1.02);
  } else tp = tpW = Math.pow(Math.max(0, Math.cos(th)), 3);
  const swell = shape === "classic" || top ? 1 : 0;
  const base = shape === "cigar" ? 1.9 : 1.75;
  const t = base + (top ? top.topT - base : 0.55 * swell) * tp;
  const back = shape === "cigar" ? 0.8 + 0.2 * (0.5 + 0.5 * Math.cos(th)) : 1;
  const w = width * back + (top ? Math.max(1.6, top.topW - width) : 1.6 * swell) * tpW;
  return { t, w, flat: top ? tp * (top.round ? 0.35 : 1) : 0 };
}

export function shankGeo(rin: number, width: number, finish: Design["band"]["finish"], top?: { topW: number; topT: number; spread: number; round?: boolean }, shape: Design["band"]["shape"] = "classic") {
  const segs = 220, prof = shape === "flat" ? 40 : 28, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  const eu = shape === "flat" ? 0.12 : shape === "cigar" ? 0.4 : 0.55, ev = shape === "flat" ? 0.12 : shape === "cigar" ? 0.3 : 0.55;
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const { t, w, flat } = bandSection(width, th, top, shape, rin);
    const eU = eu + (0.16 - eu) * flat, eV = ev + (0.2 - ev) * flat;
    const dx = Math.sin(th), dy = Math.cos(th);
    for (let j = 0; j <= prof; j++) {
      const p = (j / prof) * Math.PI * 2, c = Math.cos(p), sn = Math.sin(p);
      const u = Math.sign(c) * Math.pow(Math.abs(c), eU), v = Math.sign(sn) * Math.pow(Math.abs(sn), eV);
      let r = rin + t / 2 + (u * t) / 2;
      if (finish === "knife-edge" && u > 0) r = rin + t / 2 + ((u * t) / 2) * (1.25 - 0.75 * Math.pow(Math.abs(v), 1.3));
      pos.push(dx * r, dy * r, (v * w) / 2);
      uv.push((i / segs) * 24, j / prof);
    }
  }
  for (let i = 0; i < segs; i++)
    for (let j = 0; j < prof; j++) {
      const a = i * (prof + 1) + j, b = a + 1, c = (i + 1) * (prof + 1) + j, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

