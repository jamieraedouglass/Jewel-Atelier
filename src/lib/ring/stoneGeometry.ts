import * as THREE from "three";
import { type Design, STEP_SHAPES } from "../design";

export type Pt = [number, number];
export type OutlineFn = (t: number) => Pt;

export function outlineFn(shape: Design["center"]["shape"], L: number, W: number): OutlineFn {
  const a = W / 2, b = L / 2;
  switch (shape) {
    case "round": {
      const r = Math.max(a, b);
      return (t) => [Math.cos(t * 2 * Math.PI) * r, Math.sin(t * 2 * Math.PI) * r];
    }
    case "cushion": {
      const e = 2 / 2.8;
      return (t) => {
        const th = t * 2 * Math.PI, c = Math.cos(th), s = Math.sin(th);
        return [Math.sign(c) * Math.pow(Math.abs(c), e) * a, Math.sign(s) * Math.pow(Math.abs(s), e) * b];
      };
    }
    case "pear":
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

// Distance from a stone's centre to its edge in any direction (radians round the top, the stone turned by rotationDeg),
// read off its outline into a table of 360 directions.
export function edgeRadius(shape: Design["center"]["shape"], L: number, W: number, rotationDeg = 0): (a: number) => number {
  const fn = outlineFn(shape, L, W), t = (rotationDeg * Math.PI) / 180, bins = 360, r = new Float32Array(bins);
  for (let i = 0; i < 1440; i++) {
    const [x0, z0] = fn(i / 1440), x = x0 * Math.cos(t) + z0 * Math.sin(t), z = -x0 * Math.sin(t) + z0 * Math.cos(t);
    const b = Math.round(((Math.atan2(z, x) / (2 * Math.PI)) * bins + bins) % bins) % bins;
    r[b] = Math.max(r[b], Math.hypot(x, z));
  }
  for (let p = 0; p < 4; p++) for (let b = 0; b < bins; b++) if (!r[b]) r[b] = Math.max(r[(b + 1) % bins], r[(b + bins - 1) % bins]);
  return (a: number) => r[Math.round(((a / (2 * Math.PI)) * bins + bins * 2) % bins) % bins];
}

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
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function carvedGeo(fn: OutlineFn, dome: number, belly: number, flutes: number) {
  const n = Math.max(160, flutes * 12), m = 40, pos: number[] = [], idx: number[] = [];
  const ridge = (t: number) => 0.5 + 0.5 * Math.cos(2 * Math.PI * flutes * t);
  const rows: { s: number; y: number; top: boolean }[] = [];
  for (let j = m; j >= 1; j--) { const p = (j / m) * Math.PI / 2; rows.push({ s: Math.cos(p), y: -Math.sin(p) * belly, top: false }); }
  for (let j = 0; j <= m; j++) { const p = (j / m) * Math.PI / 2; rows.push({ s: Math.cos(p), y: Math.sin(p) * dome, top: true }); }
  rows.forEach(({ s, y, top }) => {
    for (let i = 0; i < n; i++) {
      const t = i / n, [x, z] = fn(t), groove = 1 - ridge(t);
      const edge = s * (1 - 0.04 * groove);
      const cut = top ? 1 - 0.22 * Math.pow(groove, 1.6) * Math.pow(s, 0.8) : 1;
      pos.push(x * edge, y * cut, z * edge);
    }
  });
  for (let r = 0; r < rows.length - 1; r++)
    for (let i = 0; i < n; i++) {
      const a = r * n + i, b = r * n + ((i + 1) % n), c = (r + 1) * n + i, d = (r + 1) * n + ((i + 1) % n);
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

type Tier = { s: number; y: number; twist?: number };

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

// `standing`: a baguette set lengthways along the centre stone's side (hugging it) rather than pointing out along the band.
function sideOutline(kind: Design["sides"]["kind"], L: number, W: number, standing = false): Pt[] {
  if (kind === "baguette" && standing) return [[0, L / 2], [W, L / 2], [W, -L / 2], [0, -L / 2]];
  if (kind === "half-moon") {
    const pts: Pt[] = [];
    for (let i = 0; i <= 14; i++) { const a = Math.PI / 2 - (i * Math.PI) / 14; pts.push([W * Math.cos(a), (L / 2) * Math.sin(a)]); }
    return pts;
  }
  if (kind === "trapezoid") return [[0, L / 2], [W, L * 0.27], [W, -L * 0.27], [0, -L / 2]];
  if (kind === "baguette") return [[0, W / 2], [L, W * 0.38], [L, -W * 0.38], [0, -W / 2]];
  if (kind === "oval") {
    const pts: Pt[] = [];
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 2 * Math.PI; pts.push([W / 2 + (Math.cos(a) * W) / 2, (Math.sin(a) * L) / 2]); }
    return pts;
  }
  if (kind === "pear") {
    const fn = outlineFn("pear", L, W), b = L / 2, pts: Pt[] = [];
    for (let i = 0; i < 24; i++) { const [x, z] = fn(i / 24); pts.push([b - z, x]); }
    return pts;
  }
  const pts: Pt[] = [];
  for (let i = 0; i < 16; i++) { const a = (i / 16) * 2 * Math.PI; pts.push([W / 2 + Math.cos(a) * W / 2, Math.sin(a) * W / 2]); }
  return pts;
}

export function sideStoneGeo(kind: Design["sides"]["kind"], L: number, W: number, standing = false) {
  const ol = sideOutline(kind, L, W, standing);
  const span = (kind === "baguette" && !standing) || kind === "pear" ? L : W;
  const cx = kind === "round" || kind === "oval" ? W / 2 : kind === "pear" ? L * 0.55 : span * 0.42;
  const brilliant = kind === "round" || kind === "oval" || kind === "pear";
  const crown = Math.min(L, W) * (brilliant ? 0.16 : 0.3), pav = Math.min(L, W) * (brilliant ? 0.43 : 0.75);
  const ccw = [...ol].reverse();
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

