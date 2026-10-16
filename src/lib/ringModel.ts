import * as THREE from "three";
import { type Design, STEP_SHAPES, ringInnerDiameter, sideStoneDims } from "./design";

/**
 * Builds the whole ring as a plain three.js Group from a Design.
 * Units are millimetres. The band lies in the XY plane, the finger runs along Z,
 * the top of the ring is +Y. Stone "length" runs along Z (north–south on the hand).
 */

export type Pt = [number, number]; // [x across the finger, z along the finger]
export type OutlineFn = (t: number) => Pt; // t in [0,1), counter-clockwise, t=0 at +x

/* ---------------- outlines ---------------- */

export function outlineFn(shape: Design["center"]["shape"], L: number, W: number): OutlineFn {
  const a = W / 2, b = L / 2;
  switch (shape) {
    case "round": {
      const r = Math.max(a, b);
      return (t) => [Math.cos(t * 2 * Math.PI) * r, Math.sin(t * 2 * Math.PI) * r];
    }
    case "cushion": {
      const e = 2 / 2.8; // superellipse
      return (t) => {
        const th = t * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
        return [Math.sign(c) * Math.pow(Math.abs(c), e) * a, Math.sign(s) * Math.pow(Math.abs(s), e) * b];
      };
    }
    case "pear":
      // point toward +z (the tip points down the finger)
      return (t) => {
        const th = t * 2 * Math.PI, s = Math.sin(th);
        const taper = Math.pow((1 - s) / 2, 0.45);
        return [Math.cos(th) * a * taper * 1.12, s * b];
      };
    case "marquise": {
      const R = (b * b + a * a) / (2 * a);
      return (t) => {
        const th = t * 2 * Math.PI, z = Math.sin(th) * b;
        const x = Math.sqrt(Math.max(0, R * R - z * z)) - (R - a);
        return [Math.sign(Math.cos(th)) * x, z];
      };
    }
    case "emerald":
    case "asscher":
    case "octagon":
    case "radiant": {
      const k = shape === "emerald" ? 0.32 : shape === "asscher" ? 0.38 : shape === "octagon" ? 0.586 : 0.16;
      const c = Math.min(a, b) * k;
      return polygonFn([[a, -b + c], [a, b - c], [a - c, b], [-a + c, b], [-a, b - c], [-a, -b + c], [-a + c, -b], [a - c, -b]]);
    }
    case "princess":
    case "baguette":
      return polygonFn([[a, -b], [a, b], [-a, b], [-a, -b]]);
    case "hexagon":
      return polygonFn([[a, -b * 0.5], [a, b * 0.5], [0, b], [-a, b * 0.5], [-a, -b * 0.5], [0, -b]]);
    case "trillion": {
      // softly curved sides, point toward +Z
      const pts: Pt[] = [];
      const V: Pt[] = [[a, -b], [0, b], [-a, -b]];
      for (let i = 0; i < 3; i++) {
        const p = V[i], q = V[(i + 1) % 3];
        for (let k = 0; k < 8; k++) {
          const t = k / 8, bulge = Math.sin(t * Math.PI) * 0.07;
          const mx = p[0] + (q[0] - p[0]) * t, mz = p[1] + (q[1] - p[1]) * t;
          pts.push([mx * (1 + bulge), mz * (1 + bulge) + bulge * b * 0.3]);
        }
      }
      return polygonFn(pts);
    }
    case "kite":
      return polygonFn([[a, -b * 0.4], [0, b], [-a, -b * 0.4], [0, -b]]);
    case "shield":
      return polygonFn([[a, -b], [a, b * 0.15], [0, b], [-a, b * 0.15], [-a, -b]]);
    case "half-moon": {
      const pts: Pt[] = [];
      for (let i = 0; i <= 24; i++) { const th = (i / 24) * Math.PI; pts.push([Math.cos(th) * a, -b + Math.sin(th) * 2 * b]); }
      return polygonFn(pts);
    }
    case "heart":
      // classic heart curve, point toward +Z, lobes toward −Z
      return (t) => {
        const u = 2 * Math.PI * (t - 0.25) + Math.PI;
        const hx = 16 * Math.pow(Math.sin(u), 3);
        const hy = 13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
        return [(hx / 16) * a, b - ((hy + 17) / 29) * 2 * b];
      };
    case "old-mine": {
      const e = 2 / 3.6;
      return (t) => {
        const th = t * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
        return [Math.sign(c) * Math.pow(Math.abs(c), e) * a, Math.sign(s) * Math.pow(Math.abs(s), e) * b];
      };
    }
    case "oval":
    default:
      return (t) => [Math.cos(t * 2 * Math.PI) * a, Math.sin(t * 2 * Math.PI) * b];
  }
}

/** where claws go: on the corners of angular shapes, protecting points, evenly round curved shapes (degrees along the outline) */
export function clawDegrees(shape: Design["center"]["shape"], L: number, W: number, style: Design["setting"]["style"]): number[] {
  const a = W / 2, b = L / 2;
  const anchors: Pt[] | null = (() => {
    switch (shape) {
      case "emerald": case "asscher": case "octagon": case "radiant": {
        const k = shape === "emerald" ? 0.32 : shape === "asscher" ? 0.38 : shape === "octagon" ? 0.586 : 0.16, c = Math.min(a, b) * k;
        return [[a - c / 2, b - c / 2], [-a + c / 2, b - c / 2], [-a + c / 2, -b + c / 2], [a - c / 2, -b + c / 2]];
      }
      case "princess": case "baguette": return [[a, b], [-a, b], [-a, -b], [a, -b]];
      case "hexagon": return [[a, -b * 0.5], [a, b * 0.5], [0, b], [-a, b * 0.5], [-a, -b * 0.5], [0, -b]];
      case "trillion": return [[a, -b], [0, b], [-a, -b]];
      case "kite": return [[a, -b * 0.4], [0, b], [-a, -b * 0.4], [0, -b]];
      case "shield": return [[a, -b], [a, b * 0.15], [0, b], [-a, b * 0.15], [-a, -b]];
      case "half-moon": return [[a, -b], [a * 0.7, b * 0.45], [-a * 0.7, b * 0.45], [-a, -b]];
      case "heart": return [[0, b], [a * 0.95, -b * 0.25], [a * 0.5, -b * 0.95], [-a * 0.5, -b * 0.95], [-a * 0.95, -b * 0.25]];
      default: return null;
    }
  })();
  if (style === "bezel") return [];
  if (anchors) {
    const fn = outlineFn(shape, L, W);
    const ts = anchors.map(([x, z]) => {
      let best = 0, bd = Infinity;
      for (let i = 0; i < 720; i++) { const [px, pz] = fn(i / 720); const dd = (px - x) ** 2 + (pz - z) ** 2; if (dd < bd) { bd = dd; best = i / 2; } }
      return best;
    });
    return style === "double-claw" ? ts.flatMap((t) => [t - 5, t + 5]) : ts;
  }
  const base = style === "double-claw" ? [45, 135, 225, 315].flatMap((x) => [x - 8, x + 8]) : style === "six-claw" ? [30, 90, 150, 210, 270, 330] : [45, 135, 225, 315];
  if (shape === "pear" || shape === "marquise") base.push(90);
  if (shape === "marquise") base.push(270);
  return base;
}

function polygonFn(poly: Pt[]): OutlineFn {
  const seg = poly.map((p, i) => {
    const q = poly[(i + 1) % poly.length];
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const total = seg.reduce((x, y) => x + y, 0);
  return (t) => {
    let d = (((t % 1) + 1) % 1) * total;
    for (let i = 0; i < poly.length; i++) {
      if (d <= seg[i]) {
        const p = poly[i], q = poly[(i + 1) % poly.length], k = d / seg[i];
        return [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
      }
      d -= seg[i];
    }
    return poly[0];
  };
}

/* ---------------- stones ---------------- */

export function cabochonGeo(fn: OutlineFn, dome: number, belly: number) {
  const n = 160, m = 48, pos: number[] = [], idx: number[] = [];
  const rows: { s: number; y: number }[] = [];
  for (let j = m; j >= 1; j--) { const p = (j / m) * Math.PI / 2; rows.push({ s: Math.cos(p), y: -Math.sin(p) * belly }); }
  for (let j = 0; j <= m; j++) { const p = (j / m) * Math.PI / 2; rows.push({ s: Math.cos(p), y: Math.sin(p) * dome }); }
  rows.forEach(({ s, y }) => {
    for (let i = 0; i < n; i++) { const [x, z] = fn(i / n); pos.push(x * s, y, z * s); }
  });
  for (let r = 0; r < rows.length - 1; r++)
    for (let i = 0; i < n; i++) {
      const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + i, d = (r + 1) * n + ((i + 1) % n);
      idx.push(a, c, b, b, c, d); // outward-facing
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export type Tier = { s: number; y: number; twist?: number };

/** Faceted stone from stacked outline tiers; flat-shaded so every facet catches light on its own. */
export function facetedGeo(ring: (s: number, y: number, twist: number) => THREE.Vector3[], center: THREE.Vector3, tiers: Tier[], tableY: number, culetY: number) {
  const rings = tiers.map((t) => ring(t.s, t.y, t.twist ?? 0));
  const pos: number[] = [];
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  const m = rings[0].length;
  for (let r = 0; r < rings.length - 1; r++) {
    const A = rings[r], B = rings[r + 1];
    for (let i = 0; i < m; i++) { const j = (i + 1) % m; tri(A[i], A[j], B[j]); tri(A[i], B[j], B[i]); }
  }
  const T = rings[0], tc = new THREE.Vector3(center.x, tableY, center.z);
  for (let i = 0; i < m; i++) tri(tc, T[(i + 1) % m], T[i]);
  const K = rings[rings.length - 1], kc = new THREE.Vector3(center.x, culetY, center.z);
  for (let i = 0; i < m; i++) tri(kc, K[i], K[(i + 1) % m]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function centerFacetedGeo(shape: Design["center"]["shape"], fn: OutlineFn, W: number, crown: number) {
  const step = STEP_SHAPES.has(shape);
  const n = step ? 32 : shape === "heart" || shape === "trillion" ? 40 : shape === "old-mine" ? 24 : 16;
  const ring = (s: number, y: number, twist: number) => {
    const out: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) { const [x, z] = fn((i + twist) / n); out.push(new THREE.Vector3(x * s, y, z * s)); }
    return out;
  };
  const pav = W * 0.43;
  const tiers: Tier[] = step
    ? [{ s: 0.6, y: crown }, { s: 0.72, y: crown * 0.82 }, { s: 0.86, y: crown * 0.5 }, { s: 1, y: 0.05 }, { s: 1, y: -0.05 }, { s: 0.82, y: -pav * 0.35 }, { s: 0.6, y: -pav * 0.65 }, { s: 0.36, y: -pav * 0.9 }]
    : [{ s: 0.56, y: crown }, { s: 0.8, y: crown * 0.55, twist: 0.5 }, { s: 1, y: 0.04 }, { s: 1, y: -0.04 }, { s: 0.55, y: -pav * 0.55, twist: 0.5 }, { s: 0.18, y: -pav * 0.92 }];
  return facetedGeo(ring, new THREE.Vector3(), tiers, crown, -pav);
}

/** side-stone outlines: flat edge at x=0 facing the centre stone, shape extends toward +x */
function sideOutline(kind: Design["sides"]["kind"], L: number, W: number): Pt[] {
  if (kind === "half-moon") {
    const pts: Pt[] = [];
    for (let i = 0; i <= 14; i++) { const a = Math.PI / 2 - (i * Math.PI) / 14; pts.push([W * Math.cos(a), (L / 2) * Math.sin(a)]); }
    return pts;
  }
  if (kind === "trapezoid") return [[0, L / 2], [W, L * 0.27], [W, -L * 0.27], [0, -L / 2]];
  if (kind === "baguette") return [[0, W / 2], [L, W * 0.38], [L, -W * 0.38], [0, -W / 2]]; // tapered, long axis outward
  if (kind === "oval") {
    // long axis along the finger, like the centre stone's neighbours in an oval trilogy
    const pts: Pt[] = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 2 * Math.PI; pts.push([W / 2 + (Math.cos(a) * W) / 2, (Math.sin(a) * L) / 2]); }
    return pts;
  }
  if (kind === "pear") {
    // tip pointing in toward the centre stone, round end outward
    const fn = outlineFn("pear", L, W), b = L / 2, pts: Pt[] = [];
    for (let i = 0; i < 24; i++) { const [x, z] = fn(i / 24); pts.push([b - z, x]); }
    return pts;
  }
  const pts: Pt[] = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI; pts.push([W / 2 + Math.cos(a) * W / 2, Math.sin(a) * W / 2]); }
  return pts;
}

export function sideStoneGeo(kind: Design["sides"]["kind"], L: number, W: number) {
  const ol = sideOutline(kind, L, W);
  const span = kind === "baguette" || kind === "pear" ? L : W;
  const cx = kind === "round" || kind === "oval" ? W / 2 : kind === "pear" ? L * 0.55 : span * 0.42;
  const crown = Math.min(L, W) * 0.3, pav = Math.min(L, W) * 0.75;
  const ccw = [...ol].reverse(); // facets must wind counter-clockwise to face outward
  const ring = (s: number, y: number) => ccw.map(([x, z]) => new THREE.Vector3(cx + (x - cx) * s, y, z * s));
  const tiers: Tier[] = kind === "round" || kind === "oval" || kind === "pear"
    ? [{ s: 0.56, y: crown }, { s: 0.8, y: crown * 0.55 }, { s: 1, y: 0.04 }, { s: 1, y: -0.04 }, { s: 0.5, y: -pav * 0.6 }, { s: 0.15, y: -pav * 0.95 }]
    : [{ s: 0.46, y: crown }, { s: 0.6, y: crown * 0.87 }, { s: 0.74, y: crown * 0.65 }, { s: 0.88, y: crown * 0.36 }, { s: 1, y: 0.07 }, { s: 1, y: -0.07 },
       { s: 0.84, y: -pav * 0.31 }, { s: 0.64, y: -pav * 0.57 }, { s: 0.42, y: -pav * 0.79 }, { s: 0.18, y: -pav * 0.95 }];
  const g = facetedGeo((s, y) => ring(s, y), new THREE.Vector3(cx, 0, 0), tiers, crown, -pav);
  return { g, ol, cx, span, pav };
}

export function roseCutGeo(R: number, H: number) {
  const pos: number[] = [];
  const tri = (a: number[], b: number[], c: number[]) => pos.push(...a, ...b, ...c);
  const apex = [0, H, 0], A: number[][] = [], B: number[][] = [];
  for (let i = 0; i < 6; i++) { const t = (i / 6) * Math.PI * 2 + Math.PI / 6; A.push([Math.cos(t) * R * 0.52, H * 0.58, Math.sin(t) * R * 0.52]); }
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2; B.push([Math.cos(t) * R, 0, Math.sin(t) * R]); }
  for (let i = 0; i < 6; i++) {
    const a = A[i], a2 = A[(i + 1) % 6], b0 = B[(2 * i + 1) % 12], b1 = B[(2 * i + 2) % 12], b2 = B[(2 * i + 3) % 12];
    tri(apex, a2, a); tri(a, a2, b1); tri(a, b1, b0); tri(a2, b2, b1);
  }
  for (let i = 0; i < 12; i++) tri([0, 0, 0], B[i], B[(i + 1) % 12]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

/* ---------------- metal ---------------- */

const METAL_BASE: Record<Design["metal"], { color: number; roughness: number }> = {
  "yellow-gold": { color: 0xe6c27a, roughness: 0.22 },
  "rose-gold": { color: 0xe7ac90, roughness: 0.22 },
  "white-gold": { color: 0xd6d5d1, roughness: 0.24 },
  platinum: { color: 0xcdd0d4, roughness: 0.2 },
  "oxidised-silver": { color: 0x8e8a84, roughness: 0.46 },
};
/** higher-karat yellow and rose gold is richer and warmer: 22k reads deep, 24k almost orange */
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

/**
 * The band. By default it thickens a little under the head. For designs set into the band, `top` widens and deepens it
 * across the top so the head's stones sit in the metal: topW = width at the top, topT = depth at the top, spread = how far
 * round (mm either side of the top) the widening reaches.
 */
/** band thickness and width at angle th (0 = top), shared by the band and the stones set into it */
export function bandSection(width: number, th: number, top?: { topW: number; topT: number; spread: number }, shape: Design["band"]["shape"] = "classic", rin = 8.5) {
  const ang = top ? Math.asin(Math.min(0.97, top.spread / (rin + 2))) : 0;
  const k = top ? Math.max(1.2, Math.log(0.5) / Math.log(Math.cos(ang))) : 3;
  const tp = Math.pow(Math.max(0, Math.cos(th)), k);
  // flat and cigar bands stay even all the way round (a cigar band narrows a little at the back)
  const swell = shape === "classic" || top ? 1 : 0;
  const base = shape === "cigar" ? 1.9 : 1.75;
  const t = base + (top ? top.topT - base : 0.55 * swell) * tp;
  const back = shape === "cigar" ? 0.8 + 0.2 * (0.5 + 0.5 * Math.cos(th)) : 1;
  const w = width * back + (top ? Math.max(1.6, top.topW - width) : 1.6 * swell) * tp;
  return { t, w };
}

export function shankGeo(rin: number, width: number, finish: Design["band"]["finish"], top?: { topW: number; topT: number; spread: number }, shape: Design["band"]["shape"] = "classic") {
  const segs = 220, prof = shape === "flat" ? 40 : 28, pos: number[] = [], uv: number[] = [], idx: number[] = [];
  // cross-section roundness: flat bands are almost square in section, cigar bands domed on top
  const eu = shape === "flat" ? 0.12 : shape === "cigar" ? 0.4 : 0.55, ev = shape === "flat" ? 0.12 : shape === "cigar" ? 0.3 : 0.55;
  for (let i = 0; i <= segs; i++) {
    const th = (i / segs) * Math.PI * 2;
    const { t, w } = bandSection(width, th, top, shape, rin);
    const dx = Math.sin(th), dy = Math.cos(th);
    for (let j = 0; j <= prof; j++) {
      const p = (j / prof) * Math.PI * 2, c = Math.cos(p), sn = Math.sin(p);
      const u = Math.sign(c) * Math.pow(Math.abs(c), eu), v = Math.sign(sn) * Math.pow(Math.abs(sn), ev);
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

/* ---------------- assembly ---------------- */

export function buildRing(d: Design): THREE.Group {
  const root = new THREE.Group();
  const tone = metalTone(d);
  const metal = new THREE.MeshPhysicalMaterial({ color: tone.color, metalness: 1, roughness: tone.roughness, envMapIntensity: 1.3, clearcoat: 0.3, clearcoatRoughness: 0.1 });
  const bandMetal = metal.clone();
  if (d.band.finish === "textured") {
    const bump = textureBump();
    if (bump) { bandMetal.bumpMap = bump; bandMetal.bumpScale = 0.6; bandMetal.roughness = tone.roughness + 0.12; }
  }
  // Diamonds: a thin dielectric "glass" skin over mirrored facets. Real-time transmission can't do total
  // internal reflection, so mirrored facets stand in for the hall-of-mirrors look of a step cut.
  const diamond = new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0, roughness: 0, transparent: true, opacity: 0.22, specularIntensity: 1, envMapIntensity: 3, flatShading: true, depthWrite: false });
  const mirror = new THREE.MeshPhysicalMaterial({ color: 0xf2f5ff, metalness: 1, roughness: 0, envMapIntensity: 4.5, emissive: 0xf2f5ff, emissiveIntensity: 0.12, flatShading: true, iridescence: 0.25, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 650] });
  const roseMat = new THREE.MeshPhysicalMaterial({ color: 0xf4f6ff, metalness: 1, roughness: 0, envMapIntensity: 4, flatShading: true });

  const tube = (pts: THREE.Vector3[], r: number, closed = false) =>
    new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), closed ? 200 : 32, r, 12, closed), metal);
  const beads = (pts: THREE.Vector3[], r: number) => {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(r, 10, 8), metal, pts.length), M = new THREE.Matrix4();
    pts.forEach((p, i) => { M.makeTranslation(p.x, p.y, p.z); im.setMatrixAt(i, M); });
    return im;
  };

  /* band */
  const RIN = ringInnerDiameter(d.ringSize) / 2;
  const shankMesh = new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish, undefined, d.band.shape), bandMetal);
  shankMesh.userData.shank = true;
  root.add(shankMesh);
  const SHANK_TOP = RIN + 2.3;

  /* centre stone (stone + claws live in `head`, which turns with the stone's angle) */
  const head = new THREE.Group();
  root.add(head);
  root.userData.head = head;
  const c = d.center;
  const L = c.lengthMm, W = c.widthMm, fn = outlineFn(c.shape, L, W);
  const isCab = c.cut === "cabochon";
  const belly = isCab ? Math.min(W * 0.14, 2) : W * 0.43;
  const GY = SHANK_TOP + (isCab ? belly * 0.56 : belly * 0.45) + d.setting.height * 4;
  const color = new THREE.Color(c.color);
  const colorless = c.gem === "diamond" || c.gem === "aquamarine";
  // three.js treats hex colours as sRGB and lights in linear space, so a cabochon needs a little
  // self-glow (emissive) to read with the velvety body colour you see in person.
  const stoneMat = new THREE.MeshPhysicalMaterial({
    color, metalness: 0,
    roughness: isCab ? 0.22 : 0.01,
    transmission: isCab ? c.clarity * 0.45 : 0.2 + c.clarity * 0.75,
    thickness: W * 0.8,
    ior: c.gem === "diamond" ? 2.42 : c.gem === "emerald" || c.gem === "aquamarine" ? 1.58 : 1.77,
    attenuationColor: color, attenuationDistance: 2 + c.clarity * 8,
    emissive: color, emissiveIntensity: isCab ? 0.22 : 0.08,
    clearcoat: isCab ? 0.8 : 0, clearcoatRoughness: 0.04,
    sheen: isCab ? 0.4 : 0, sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.5,
    envMapIntensity: isCab ? 1.1 : 2.4, flatShading: !isCab, transparent: !isCab,
  });
  const stone = new THREE.Group();
  stone.userData.part = "center";
  if (isCab) stone.add(new THREE.Mesh(cabochonGeo(fn, c.domeMm, belly), stoneMat));
  else {
    const g = centerFacetedGeo(c.shape, fn, W, Math.max(0.6, c.domeMm));
    const inner = mirror.clone(); inner.color = colorless ? new THREE.Color(0xf2f5ff) : color.clone().lerp(new THREE.Color(0xffffff), 0.15);
    stone.add(new THREE.Mesh(g, inner), new THREE.Mesh(g, stoneMat));
  }
  stone.position.y = GY;
  head.add(stone);

  /* head */
  const loop = (s: number, y: number, n = 96) => Array.from({ length: n }, (_, i) => { const [x, z] = fn(i / n); return new THREE.Vector3(x * s, y, z * s); });
  const lowRailY = GY - Math.min(belly, 2) - 0.1;
  head.add(tube(loop(0.7, lowRailY), 0.42, true));
  if (d.setting.style === "bezel") {
    const shape = new THREE.Shape(loop(1.09, 0).map((p) => new THREE.Vector2(p.x, p.z)));
    shape.holes.push(new THREE.Path(loop(0.98, 0).reverse().map((p) => new THREE.Vector2(p.x, p.z))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 4, curveSegments: 64 });
    g.rotateX(Math.PI / 2); g.translate(0, GY + 0.55, 0); g.computeVertexNormals();
    head.add(new THREE.Mesh(g, metal));
  } else {
    head.add(tube(loop(0.95, GY - 0.55), 0.38, true));
    // side stones that hug the centre take over the claws on those sides (they share them), so nothing holds them apart
    const hugging = d.sides.kind !== "none" && d.sides.hug && d.sides.follow !== "band";
    const positions = clawDegrees(c.shape, L, W, d.setting.style).filter((deg) => {
      if (!hugging) return true;
      const a = ((deg % 360) + 360) % 360;
      return Math.min(Math.abs(a - 0), Math.abs(a - 360), Math.abs(a - 180)) > 38;
    });
    const tipY = isCab ? Math.min(0.55, c.domeMm * 0.15) : Math.max(0.4, c.domeMm * 0.5);
    const r = d.setting.style === "double-claw" ? 0.34 : 0.44;
    positions.forEach((deg) => {
      const [x, z] = fn(deg / 360);
      const P = (s: number, y: number) => new THREE.Vector3(x * s, y, z * s);
      const pad = 1 + (r + 0.05) / Math.max(1, Math.hypot(x, z));
      head.add(tube([P(0.62, lowRailY - 0.7), P(0.7, lowRailY), P(0.97, GY - 0.55), P(pad + 0.01, GY + 0.05), P(pad - 0.01, GY + tipY)], r));
      const tip = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), metal);
      tip.scale.set(1, 0.8, 1); tip.position.copy(P(pad - 0.01, GY + tipY)); head.add(tip);
    });
  }
  head.rotation.y = THREE.MathUtils.degToRad(d.center.rotation ?? 0);

  /* posts into the shank */
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x, z] = fn(((sx > 0 ? (sz > 0 ? 45 : 315) : sz > 0 ? 135 : 225)) / 360);
    root.add(tube([new THREE.Vector3(x * 0.49, lowRailY, z * 0.49), new THREE.Vector3(sx * 2.4, SHANK_TOP - 0.9, sz * 1.3), new THREE.Vector3(sx * 2.6, SHANK_TOP - 1.7, sz * 1.1)], 0.5));
  }

  /* rose-cut gallery */
  if (d.gallery.roseCut) {
    const rg = roseCutGeo(0.68, 0.38);
    for (const sz of [-1, 1]) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(rg, roseMat));
      const bez = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.13, 12, 48), metal); bez.rotation.x = Math.PI / 2; g.add(bez);
      g.add(beads(Array.from({ length: 26 }, (_, i) => new THREE.Vector3(Math.cos((i / 26) * Math.PI * 2) * 0.94, 0.04, Math.sin((i / 26) * Math.PI * 2) * 0.94)), 0.075));
      if (d.setting.style === "bezel") { g.position.set(0, GY - 0.4, sz * (L / 2 + 0.75)); g.rotation.x = (sz * Math.PI) / 2; }
      else { g.position.set(0, GY - 1.0, sz * (L / 2) * 0.86); g.rotation.x = sz * (Math.PI / 2 - 0.45); }
      root.add(g);
    }
  }

  /* side stones */
  if (d.sides.kind !== "none") {
    // hugging: the straight edge runs most of the centre stone's length, like a classic half-moon trilogy
    const asp = { "half-moon": 0.46, trapezoid: 0.5, baguette: 2.6, round: 1, oval: 0.74, pear: 1.5, none: 1 }[d.sides.kind];
    const hugL = L * d.sides.hugFrac;
    const { L: sl, W: sw } = d.sides.hug
      ? d.sides.kind === "baguette" ? { L: W * 0.75, W: W * 0.3 } : d.sides.kind === "round" ? { L: hugL * 0.8, W: hugL * 0.8 } : d.sides.kind === "pear" ? { L: hugL * 0.9, W: hugL * 0.6 } : { L: hugL, W: hugL * asp }
      : sideStoneDims(d.sides.kind, d.sides.sizeCt);
    const { g, ol, cx, pav } = sideStoneGeo(d.sides.kind, sl, sw);
    const sc = (s: number) => ol.map(([x, z]) => new THREE.Vector2(cx + (x - cx) * s, z * s));
    const hug = d.sides.hug;
    // hugging stones get a fine rim, so the stones themselves meet the centre stone
    const shape = new THREE.Shape(sc(hug ? 1.035 : 1.09));
    shape.holes.push(new THREE.Path(sc(hug ? 0.985 : 0.965).reverse()));
    const bz = new THREE.ExtrudeGeometry(shape, { depth: d.sides.hug ? Math.min(0.7, pav * 0.25) : d.sides.kind === "round" || d.sides.kind === "oval" || d.sides.kind === "pear" ? Math.min(0.9, pav * 0.3) : Math.min(1.9, pav * 0.7), bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 3, curveSegments: 24 });
    bz.rotateX(Math.PI / 2); bz.translate(0, 0.18, 0); bz.computeVertexNormals();
    // the centre stone's edge in the direction of the side stones (its outline at the widest point across the finger)
    const edgeX = Math.max(...Array.from({ length: 180 }, (_, i) => fn(i / 180)[0]));
    const gap = (hug ? edgeX : W / 2) + (d.setting.style === "bezel" ? 0.62 : hug ? 0.04 : 0.18);
    if (hug) {
      // fitted: curve the side stones' inner edge to follow the centre stone, the way a cutter matches a pair to a stone,
      // so they sit flush all along the edge instead of touching at one point
      const edgeAt = (z: number) => {
        let best = 0;
        for (let i = 0; i < 360; i++) { const [x, zz] = fn(i / 360); if (x > 0 && Math.abs(zz - z) < L / 90 + 0.05) best = Math.max(best, x); }
        return best || edgeX * 0.6;
      };
      const table = Array.from({ length: 41 }, (_, i) => { const z = -sl / 2 + (i / 40) * sl; return { z, e: edgeAt(z) }; });
      const eAt = (z: number) => { const t = Math.min(40, Math.max(0, ((z + sl / 2) / sl) * 40)); const i = Math.floor(t), f = t - i; const a = table[i], b = table[Math.min(40, i + 1)]; return a.e + (b.e - a.e) * f; };
      const spanX = Math.max(...ol.map(([x]) => x)) || 1;
      for (const geo of [g, bz]) {
        const pos = geo.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const x = pos.getX(i), z = pos.getZ(i);
          const k = Math.max(0, 1 - x / spanX);
          pos.setX(i, x + (eAt(z) - edgeX) * k);
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      }
    }
    if (d.sides.follow === "band") {
      /* curving with the band: the band thickens and widens under the side stones, and each stone (with its rim) is bent
         along the band's own curve and set into its surface, so it sits flush instead of standing up beside the centre */
      const spanX = Math.max(...ol.map(([x]) => x)) || 1;
      const isCabC = c.cut === "cabochon";
      const bellyC = isCabC ? Math.min(W * 0.14, 2) : W * 0.43;
      const setIn = d.band.profile === "set-in" ? Math.max(2.9, bellyC * 0.75 + 0.6) - 0.3 : 0;
      const top = { topW: Math.max(d.band.widthMm + 1.6, sl + 1.2), topT: Math.max(2.4, pav * 0.55 + 0.9, setIn), spread: gap + spanX * 0.9 };
      shankMesh.geometry.dispose();
      shankMesh.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, top, d.band.shape);
      shankMesh.userData.top = top;
      const surf = (a: number) => RIN + bandSection(d.band.widthMm, a, top, d.band.shape, RIN).t;
      const Rmid = surf(0);
      const bend = (x: number, y: number, z: number) => {
        const a = (gap + x) / Rmid;
        const r = surf(a) - 0.12 + y;
        return new THREE.Vector3(r * Math.sin(a), r * Math.cos(a), z);
      };
      const bent = (geo: THREE.BufferGeometry) => {
        const out = geo.clone();
        const pos = out.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) { const v = bend(pos.getX(i), pos.getY(i), pos.getZ(i)); pos.setXYZ(i, v.x, v.y, v.z); }
        pos.needsUpdate = true; out.computeVertexNormals();
        return out;
      };
      const gb = bent(g), bzb = bent(bz);
      for (const side of [1, -1]) {
        const grp = new THREE.Group();
        grp.userData.part = "sides";
        grp.userData.onBand = true;
        grp.add(new THREE.Mesh(gb, mirror), new THREE.Mesh(gb, diamond), new THREE.Mesh(bzb, metal));
        // small claws at the corners, on the band's curve
        for (const [x, zEnd] of [[0, -1], [0, 1], [spanX * 0.92, -0.45], [spanX * 0.92, 0.45]] as const) {
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), metal);
          tip.position.copy(bend(x, 0.22, zEnd * (sl / 2) * (x ? 1 : 0.94)));
          grp.add(tip);
        }
        if (side < 0) grp.rotation.y = Math.PI;
        root.add(grp);
      }
    } else for (const side of [1, -1]) {
      const grp = new THREE.Group();
      grp.userData.part = "sides";
      grp.add(new THREE.Mesh(g, mirror), new THREE.Mesh(g, diamond), new THREE.Mesh(bz, metal));
      for (const z of [-1, 1].map((k) => k * Math.min(1.6, sl * 0.22))) {
        grp.add(tube([new THREE.Vector3(cx + 0.3, -pav * 0.7, z), new THREE.Vector3(-0.3, -pav * 0.72, z * 0.9), new THREE.Vector3(-(gap - W * 0.35) + 0.3, lowRailY - GY, z * 0.8)], 0.42));
      }
      if (hug) {
        // set tight against the centre, turning with it, girdles level; small shared claws at the two ends of the straight edge
        grp.position.set(side * gap, GY - 0.02, 0);
        grp.rotation.z = side * -0.03;
        if (side < 0) grp.rotation.y = Math.PI;
        for (const zEnd of [-1, 1]) {
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), metal);
          tip.scale.set(1, 0.8, 1);
          tip.position.set(side * (gap - 0.02), GY + 0.25, zEnd * (sl / 2) * 0.96);
          head.add(tip, tube([new THREE.Vector3(side * (gap - 0.02), GY + 0.2, zEnd * (sl / 2) * 0.96), new THREE.Vector3(side * gap * 0.9, lowRailY, zEnd * (sl / 2) * 0.8)], 0.3));
        }
        head.add(grp);
      } else {
        grp.position.set(side * (gap + 0.13), GY - 0.05, 0);
        grp.rotation.z = -0.08;
        if (side < 0) grp.rotation.y = Math.PI;
        root.add(grp);
      }
    }
  }
  root.userData.girdleY = GY;
  return root;
}

export function disposeGroup(g: THREE.Object3D) {
  g.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
