import { geometryCache } from "../cache";
import * as THREE from "three";
import { BEAD_GEMS, type CenterStone, type Design, type Gem } from "../design";
import { type OutlineFn, cabochonGeo, carvedGeo, centerFacetedGeo, clawDegrees, facetedGeo, outlineFn } from "../ringModel";
import { COLORLESS, v3 } from "./common";
import { type Mats } from "./materials";
import { inclusionSpecks, phenomenonLayer } from "./character";
import { chroma } from "../design/character";

/* ================= stone geometry by cut ================= */

/** stone bodies, shared between builds (a slider drag reuses the shapes it passes through) */
const stoneGeometry = geometryCache(400);
export function cutGeometry(cut: CenterStone["cut"], shape: CenterStone["shape"], L: number, W: number, dome: number) {
  const key = `${cut}|${shape}|${L.toFixed(2)}|${W.toFixed(2)}|${dome.toFixed(2)}`;
  return stoneGeometry(key, () => {
    const fn = outlineFn(shape, L, W);
    if (cut === "cabochon") return cabochonGeo(fn, dome, Math.min(W * 0.14, 2));
    if (cut === "briolette") return briolGeo(L, W);
    if (cut === "bead") return beadGeo(shape, L, W);
    if (cut === "carved") return carvedGeo(fn, dome, Math.min(W * 0.14, 2), Math.round(Math.max(12, Math.min(36, (Math.PI * (L + W)) / 2 / 2.2))));
    if (cut === "faceted") return centerFacetedGeo(shape, fn, W, Math.max(0.3, dome));
    return lowCutGeo(fn, cut as "rose-cut" | "polki", dome);
  });
}

/**
 * a polished bead (emerald and ruby beads, pearl drops), centred on y = 0, length along Z: an ellipsoid, or for a pear
 * a smooth drop with its narrow end up (−Z, where it is drilled) and its fullness low (+Z), as it hangs
 */
function beadGeo(shape: CenterStone["shape"], L: number, W: number) {
  if (shape === "pear" || shape === "heart") {
    // a soft teardrop: narrow and rounded at the top, fullest about two-thirds down, round at the bottom
    const raw = Array.from({ length: 41 }, (_, i) => { const u = i / 40; return Math.pow(Math.sin(Math.PI * u), 0.7) * (0.45 + 0.55 * Math.pow(u, 0.8)); });
    const peak = Math.max(...raw);
    const pts = raw.map((r, i) => new THREE.Vector2(Math.max(0.001, (W / 2) * (r / peak)), -L / 2 + (i / 40) * L));
    const g = new THREE.LatheGeometry(pts, 40);
    g.rotateX(Math.PI / 2); // axis Y → Z, narrow end toward −Z
    g.computeVertexNormals();
    return g;
  }
  return new THREE.SphereGeometry(0.5, 40, 28).scale(W, W * 0.94, L);
}

/** briolette: a teardrop faceted all over, hanging along Z with its tip toward +Z (turn 180° to point it up) */
function briolGeo(L: number, W: number) {
  // rings of facets down the drop, each ring turned half a facet from the last, so the facets are triangles that flash
  const n = 9, rings = 7, pos: number[] = [];
  const P: THREE.Vector3[][] = [];
  for (let k = 1; k < rings; k++) {
    const t = k / rings, r = (W / 2) * Math.sin(Math.PI * Math.pow(t, 0.62)), y = -L / 2 + t * L;
    P.push(Array.from({ length: n }, (_, i) => { const a = ((i + (k % 2) * 0.5) / n) * Math.PI * 2; return v3(Math.cos(a) * r, y, Math.sin(a) * r); }));
  }
  const bottom = v3(0, -L / 2, 0), tip = v3(0, L / 2, 0);
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let i = 0; i < n; i++) tri(bottom, P[0][i], P[0][(i + 1) % n]);
  for (let k = 0; k < P.length - 1; k++) {
    const A = P[k], B = P[k + 1], odd = (k + 1) % 2 === 1;
    for (let i = 0; i < n; i++) {
      const a0 = A[i], a1 = A[(i + 1) % n];
      const b0 = odd ? B[i] : B[(i + n - 1) % n], b1 = odd ? B[(i + 1) % n] : B[i];
      tri(a0, b0, a1); tri(a1, b0, b1);
    }
  }
  const T = P[P.length - 1];
  for (let i = 0; i < n; i++) tri(T[i], tip, T[(i + 1) % n]);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  // make every face point outward whatever the winding above
  const p = g.getAttribute("position") as THREE.BufferAttribute;
  for (let f = 0; f < p.count; f += 3) {
    const a = v3().fromBufferAttribute(p, f), b = v3().fromBufferAttribute(p, f + 1), c = v3().fromBufferAttribute(p, f + 2);
    const nrm = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a));
    const ctr = a.clone().add(b).add(c).divideScalar(3).setY(0);
    if (nrm.dot(ctr) < 0) { p.setXYZ(f + 1, c.x, c.y, c.z); p.setXYZ(f + 2, b.x, b.y, b.z); }
  }
  g.rotateX(Math.PI / 2); // tip (+Y) → +Z
  g.computeVertexNormals();
  return g;
}

/** a colourless stone (white diamond, pale aquamarine) reads by sparkle; a coloured one (a canary diamond) shows its body colour */
export const isColorless = (gem: Gem, color: string) => {
  if (!COLORLESS.has(gem)) return false;
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(color).getHSL(hsl);
  // near-white, or a faint tint (a K–M or N–R diamond is still a white stone, just warmer)
  return hsl.s < 0.3 || hsl.l > 0.92 || chroma(color) < 0.25;
};

/** the faint body colour of a near-colourless stone (a yellowish diamond), or null when it's simply white */
const warmth = (color: string) => (chroma(color) > 0.06 ? new THREE.Color(color) : null);

/** rose-cut: faceted dome on a flat base. polki: flat, slightly irregular slab with a foil back. */
function lowCutGeo(fn: OutlineFn, cut: "rose-cut" | "polki", dome: number) {
  const n = cut === "polki" ? 11 : 12;
  const ring = (s: number, y: number, twist: number) =>
    Array.from({ length: n }, (_, i) => {
      const jitter = cut === "polki" ? 1 + 0.035 * Math.sin(i * 2.7 + s * 5) : 1;
      const [x, z] = fn((i + twist) / n);
      return v3(x * s * jitter, y, z * s * jitter);
    });
  const h = Math.max(0.25, dome);
  const tiers = cut === "rose-cut"
    ? [{ s: 0.48, y: h * 0.78, twist: 0.5 }, { s: 0.82, y: h * 0.42 }, { s: 1, y: 0 }, { s: 1, y: -0.05 }]
    : [{ s: 0.8, y: h }, { s: 0.94, y: h * 0.55, twist: 0.5 }, { s: 1, y: 0 }, { s: 0.93, y: -h * 0.9 }];
  return facetedGeo(ring, v3(), tiers, cut === "rose-cut" ? h : h, cut === "rose-cut" ? -0.05 : -h * 1.1);
}

/** a loose stone, girdle at y = 0, facing +Y, length along Z, with its star or inclusions if it has them */
function stoneMesh(c: CenterStone, m: Mats, scale = 1): THREE.Group {
  const g = stoneBody(c, m, scale);
  const L = c.lengthMm * scale, W = c.widthMm * scale, dome = Math.max(0.25, c.domeMm * scale);
  if ((c.cut === "cabochon" || c.cut === "carved") && !BEAD_GEMS.has(c.gem)) {
    const body = g.children[0] as THREE.Mesh | undefined;
    const star = body && phenomenonLayer(c, body.geometry, L, W);
    if (star) g.add(star);
  }
  if (c.cut !== "bead" && !BEAD_GEMS.has(c.gem)) {
    const specks = inclusionSpecks(c, outlineFn(c.shape, L, W), L, W, dome);
    if (specks) g.add(specks);
  }
  return g;
}

function stoneBody(c: CenterStone, m: Mats, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const L = c.lengthMm * scale, W = c.widthMm * scale, dome = c.domeMm * scale;
  if (c.cut === "bead") {
    g.add(new THREE.Mesh(cutGeometry("bead", c.shape, L, W, dome), BEAD_GEMS.has(c.gem) ? m.bead(c.gem, c.color) : m.stone(c, W)));
    return g;
  }
  if (BEAD_GEMS.has(c.gem) && c.cut !== "cabochon") {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), m.bead(c.gem, c.color));
    s.scale.set(W, Math.min(W, L) * 0.9, L); s.position.y = Math.min(W, L) * 0.15;
    g.add(s);
    return g;
  }
  const geo = cutGeometry(c.cut, c.shape, L, W, dome);
  if (c.cut === "cabochon" || c.cut === "carved") {
    g.add(new THREE.Mesh(geo, BEAD_GEMS.has(c.gem) ? m.bead(c.gem, c.color) : m.stone(c, W)));
    return g;
  }
  const colorless = isColorless(c.gem, c.color);
  const warm = colorless ? warmth(c.color) : null;
  const tint = c.cut === "polki" ? (colorless ? 0xfff0c8 : new THREE.Color(c.color).lerp(new THREE.Color(0xffe0a0), 0.25)) : warm ? warm : colorless ? 0xf2f5ff : new THREE.Color(c.color).lerp(new THREE.Color(0xffffff), 0.15);
  const mirror = new THREE.Mesh(geo, m.mirror(tint, c.cut === "polki" ? 2.4 : 3.6));
  // the traced pass draws colourless stones white unless told their tint
  if (warm) mirror.userData.tint = `#${warm.getHexString()}`;
  g.add(mirror, new THREE.Mesh(geo, colorless ? m.skin : m.stone(c, W)));
  return g;
}

/* ================= settings ================= */

export function tube(m: Mats, pts: THREE.Vector3[], r: number, closed = false, mat?: THREE.Material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), closed ? 120 : 24, r, 10, closed), mat ?? m.metal);
}

/** A stone in its setting, girdle at y = 0, facing +Y, length along Z. */
/** A stone in its setting, turned by its own angle (c.rotation). Callers may still rotate or place the result. */
export function setStone(c: CenterStone, style: Design["setting"]["style"], m: Mats, scale = 1): THREE.Group {
  if (c.none) return new THREE.Group();
  const inner = setStoneRaw(c, style, m, scale);
  if (!c.rotation) return inner;
  inner.rotation.y = THREE.MathUtils.degToRad(c.rotation);
  const outer = new THREE.Group();
  outer.add(inner);
  return outer;
}

export function setStoneRaw(c: CenterStone, style: Design["setting"]["style"], m: Mats, scale = 1): THREE.Group {
  const g = stoneMesh(c, m, scale);
  g.userData.part = "center"; // what a click on it edits
  const L = c.lengthMm * scale, W = c.widthMm * scale;
  const fn = outlineFn(c.shape, L, W);
  const isCab = c.cut === "cabochon" || c.cut === "carved";
  const belly = isCab ? Math.min(W * 0.14, 2) : c.cut === "faceted" ? W * 0.43 : Math.max(0.3, c.domeMm * scale);
  const dome = Math.max(0.25, c.domeMm * scale);
  const wire = Math.max(0.12, Math.min(0.42, W * 0.04));
  const loop = (s: number, y: number, n = 72) => Array.from({ length: n }, (_, i) => { const [x, z] = fn(i / n); return v3(x * s, y, z * s); });
  // polki and rose cuts are traditionally closed-set in gold (kundan); beads have no setting
  const s = c.cut === "polki" || c.cut === "rose-cut" ? "bezel" : style;
  if (c.cut === "bead") {
    // gold bead caps and a little loop on top to hang from
    const capR = Math.max(0.3, W * 0.17);
    // a drop is drilled from the top only; a round or oval bead right through
    const drilledThrough = c.shape !== "pear" && c.shape !== "heart";
    for (const z of drilledThrough ? [-L / 2, L / 2] : [-L / 2]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(capR, capR * 1.15, Math.max(0.3, L * 0.04), 16), m.metal);
      cap.rotation.x = Math.PI / 2; cap.position.z = z; g.add(cap);
    }
    const hang = new THREE.Mesh(new THREE.TorusGeometry(Math.max(0.35, W * 0.12), 0.12, 8, 16), m.metal);
    hang.position.z = -L / 2 - Math.max(0.5, W * 0.14); hang.rotation.y = Math.PI / 2; g.add(hang);
    return g;
  }
  if (BEAD_GEMS.has(c.gem) && c.cut !== "cabochon") return g;
  if (c.cut === "briolette") {
    // drilled at the tip: a gold cap and a tiny loop
    const cap = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.35, W * 0.16), 12, 8), m.metal);
    cap.position.z = L / 2; g.add(cap);
    const loopR = new THREE.Mesh(new THREE.TorusGeometry(Math.max(0.35, W * 0.14), 0.12, 8, 16), m.metal);
    loopR.position.z = L / 2 + Math.max(0.5, W * 0.25); loopR.rotation.y = Math.PI / 2; g.add(loopR);
    return g;
  }
  if (s === "bezel") {
    const shape = new THREE.Shape(loop(1 + (wire * 2.4) / W, 0).map((p) => new THREE.Vector2(p.x, p.z)));
    shape.holes.push(new THREE.Path(loop(0.96, 0).reverse().map((p) => new THREE.Vector2(p.x, p.z))));
    const depth = Math.min(belly + 0.3, Math.max(0.6, W * 0.35));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: wire * 0.5, bevelSize: wire * 0.4, bevelSegments: 3, curveSegments: 48 });
    geo.rotateX(Math.PI / 2); geo.translate(0, Math.min(0.45, dome * 0.25), 0); geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, m.metal));
    return g;
  }
  g.add(tube(m, loop(0.92, -Math.min(belly, 2) * 0.35), wire * 0.9, true));
  const degs = clawDegrees(c.shape, L, W, s);
  const tipY = isCab ? Math.min(0.5, dome * 0.15) : Math.max(0.2, dome * 0.5);
  const r = s === "double-claw" ? wire * 0.8 : wire;
  for (const deg of degs) {
    const [x, z] = fn(deg / 360);
    const pad = 1 + (r + 0.04) / Math.max(0.5, Math.hypot(x, z));
    const P = (k: number, y: number) => v3(x * k, y, z * k);
    g.add(tube(m, [P(0.55, -belly * 0.9), P(0.92, -belly * 0.35), P(pad, 0.04), P(pad - 0.02, tipY)], r));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m.metal);
    tip.scale.set(1, 0.8, 1); tip.position.copy(P(pad - 0.02, tipY)); g.add(tip);
  }
  return g;
}
