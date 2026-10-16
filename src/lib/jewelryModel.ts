import * as THREE from "three";
import { BEAD_GEMS, SHAPE_RATIO, rightEarDesign, type CenterStone, type Design, type DropPart, type Gem, bangleDiameter, estimateDims, ringInnerDiameter, roundDiameter } from "./design";
import { motifPlate, motifShapes } from "./motifModel";
import { clawDegrees, metalTone, buildRing, cabochonGeo, centerFacetedGeo, facetedGeo, outlineFn, shankGeo, type OutlineFn } from "./ringModel";

/**
 * Builds any piece from a Design.
 * Rings stand upright (see ringModel.ts). Everything else is laid flat like a jeweller's flat-lay photo:
 * stones face +Y and gravity points to +Z, so drops, fringes and pendants hang toward the viewer.
 */

export type Piece = {
  group: THREE.Group;
  /** the stone worth zooming in on */
  focus: THREE.Vector3;
  focusSize: number;
  upright: boolean;
};

const Y = new THREE.Vector3(0, 1, 0);
const COLORLESS = new Set<Gem>(["diamond", "aquamarine", "opal"]);
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* ================= materials ================= */

function makeMaterials(d: Design) {
  const tone = metalTone(d);
  const cache = new Map<string, THREE.Material>();
  const memo = <T extends THREE.Material>(key: string, make: () => T): T => {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key) as T;
  };
  return {
    metal: memo("metal", () => new THREE.MeshPhysicalMaterial({ color: tone.color, metalness: 1, roughness: tone.roughness, envMapIntensity: 1.3, clearcoat: 0.3, clearcoatRoughness: 0.1 })),
    enamel: memo("enamel", () => new THREE.MeshPhysicalMaterial({ color: d.enamel.color, metalness: 0, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.2 })),
    skin: memo("skin", () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transparent: true, opacity: 0.22, specularIntensity: 1, envMapIntensity: 3, flatShading: true, depthWrite: false })),
    mirror: (tint: THREE.ColorRepresentation = 0xf2f5ff, intensity = 3.6) =>
      memo(`mirror${new THREE.Color(tint).getHexString()}${intensity}`, () =>
        // a faint emissive floor keeps facets from reading as black when they mirror the dark studio
        new THREE.MeshPhysicalMaterial({ color: tint, metalness: 1, roughness: 0, envMapIntensity: intensity * 1.25, emissive: tint, emissiveIntensity: 0.12, flatShading: true, iridescence: 0.25, iridescenceIOR: 1.8, iridescenceThicknessRange: [250, 650] })),
    bead: (gem: Gem, color: string) =>
      memo(`bead${gem}${color}`, () =>
        gem === "pearl"
          ? new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0, sheen: 1, sheenColor: new THREE.Color("#ffd9e6"), sheenRoughness: 0.4, iridescence: 0.6, iridescenceIOR: 1.6, clearcoat: 1, clearcoatRoughness: 0.15, envMapIntensity: 1.3 })
          : new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.08, envMapIntensity: 1.1 })),
    stone: (c: Pick<CenterStone, "gem" | "cut" | "color" | "clarity">, W: number) =>
      memo(`stone${c.gem}${c.cut}${c.color}${c.clarity}${Math.round(W)}`, () => {
        const color = new THREE.Color(c.color);
        const isCab = c.cut === "cabochon";
        return new THREE.MeshPhysicalMaterial({
          color, metalness: 0, roughness: isCab ? 0.22 : 0.01,
          transmission: isCab ? c.clarity * 0.45 : 0.2 + c.clarity * 0.75, thickness: W * 0.8,
          ior: c.gem === "diamond" ? 2.42 : ["emerald", "aquamarine", "morganite"].includes(c.gem) ? 1.58 : 1.7,
          attenuationColor: color, attenuationDistance: 2 + c.clarity * 8,
          emissive: color, emissiveIntensity: isCab ? 0.22 : 0.08,
          clearcoat: isCab ? 0.8 : 0, clearcoatRoughness: 0.04,
          sheen: isCab ? 0.4 : 0, sheenColor: color.clone().lerp(new THREE.Color(0xffffff), 0.35), sheenRoughness: 0.5,
          envMapIntensity: isCab ? 1.1 : 2.4, flatShading: !isCab, transparent: !isCab,
        });
      }),
  };
}
type Mats = ReturnType<typeof makeMaterials>;

/* ================= stone geometry by cut ================= */

const geoCache = new Map<string, THREE.BufferGeometry>();
function cutGeometry(cut: CenterStone["cut"], shape: CenterStone["shape"], L: number, W: number, dome: number) {
  const key = `${cut}|${shape}|${L.toFixed(2)}|${W.toFixed(2)}|${dome.toFixed(2)}`;
  const hit = geoCache.get(key);
  if (hit) return hit;
  const fn = outlineFn(shape, L, W);
  let g: THREE.BufferGeometry;
  if (cut === "cabochon") g = cabochonGeo(fn, dome, Math.min(W * 0.14, 2));
  else if (cut === "briolette") g = briolGeo(L, W);
  else if (cut === "faceted") g = centerFacetedGeo(shape, fn, W, Math.max(0.3, dome));
  else g = lowCutGeo(fn, cut, dome);
  geoCache.set(key, g);
  return g;
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
const isColorless = (gem: Gem, color: string) => {
  if (!COLORLESS.has(gem)) return false;
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(color).getHSL(hsl);
  return hsl.s < 0.3 || hsl.l > 0.92;
};

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

/** a loose stone, girdle at y = 0, facing +Y, length along Z */
function stoneMesh(c: CenterStone, m: Mats, scale = 1): THREE.Group {
  const g = new THREE.Group();
  const L = c.lengthMm * scale, W = c.widthMm * scale, dome = c.domeMm * scale;
  if (BEAD_GEMS.has(c.gem) && c.cut !== "cabochon") {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 24), m.bead(c.gem, c.color));
    s.scale.set(W, Math.min(W, L) * 0.9, L); s.position.y = Math.min(W, L) * 0.15;
    g.add(s);
    return g;
  }
  const geo = cutGeometry(c.cut, c.shape, L, W, dome);
  if (c.cut === "cabochon") {
    g.add(new THREE.Mesh(geo, BEAD_GEMS.has(c.gem) ? m.bead(c.gem, c.color) : m.stone(c, W)));
    return g;
  }
  const colorless = isColorless(c.gem, c.color);
  const tint = c.cut === "polki" ? (colorless ? 0xfff0c8 : new THREE.Color(c.color).lerp(new THREE.Color(0xffe0a0), 0.25)) : colorless ? 0xf2f5ff : new THREE.Color(c.color).lerp(new THREE.Color(0xffffff), 0.15);
  g.add(new THREE.Mesh(geo, m.mirror(tint, c.cut === "polki" ? 2.4 : 3.6)), new THREE.Mesh(geo, colorless ? m.skin : m.stone(c, W)));
  return g;
}

/* ================= settings ================= */

function tube(m: Mats, pts: THREE.Vector3[], r: number, closed = false, mat?: THREE.Material) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, closed), closed ? 120 : 24, r, 10, closed), mat ?? m.metal);
}

/** A stone in its setting, girdle at y = 0, facing +Y, length along Z. */
/** A stone in its setting, turned by its own angle (c.rotation). Callers may still rotate or place the result. */
function setStone(c: CenterStone, style: Design["setting"]["style"], m: Mats, scale = 1): THREE.Group {
  if (c.none) return new THREE.Group();
  const inner = setStoneRaw(c, style, m, scale);
  if (!c.rotation) return inner;
  inner.rotation.y = THREE.MathUtils.degToRad(c.rotation);
  const outer = new THREE.Group();
  outer.add(inner);
  return outer;
}

function setStoneRaw(c: CenterStone, style: Design["setting"]["style"], m: Mats, scale = 1): THREE.Group {
  const g = stoneMesh(c, m, scale);
  g.userData.part = "center"; // what a click on it edits
  const L = c.lengthMm * scale, W = c.widthMm * scale;
  const fn = outlineFn(c.shape, L, W);
  const isCab = c.cut === "cabochon";
  const belly = isCab ? Math.min(W * 0.14, 2) : c.cut === "faceted" ? W * 0.43 : Math.max(0.3, c.domeMm * scale);
  const dome = Math.max(0.25, c.domeMm * scale);
  const wire = Math.max(0.12, Math.min(0.42, W * 0.04));
  const loop = (s: number, y: number, n = 72) => Array.from({ length: n }, (_, i) => { const [x, z] = fn(i / n); return v3(x * s, y, z * s); });
  // polki and rose cuts are traditionally closed-set in gold (kundan); beads have no setting
  const s = c.cut === "polki" || c.cut === "rose-cut" ? "bezel" : style;
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

/* ================= repeated elements (instanced) ================= */

type Item = { pos: THREE.Vector3; dia: number; up?: THREE.Vector3; yaw?: number; quat?: THREE.Quaternion };

function orient(o: THREE.Object3D, it: Item) {
  o.position.copy(it.pos);
  if (it.quat) o.quaternion.copy(it.quat);
  else { o.quaternion.setFromUnitVectors(Y, it.up ?? Y); o.rotateY(it.yaw ?? 0); }
  o.scale.setScalar(it.dia);
  o.updateMatrix();
}

/** small round stones in cups; beads become spheres */
const ASPECT = SHAPE_RATIO;

/** `dia` on each item is the stone's width; shaped stones are longer along their local Z by the shape's aspect */
function accents(m: Mats, gem: Gem, color: string, cut: "faceted" | "polki" | "rose-cut", items: Item[], shape: CenterStone["shape"] = "round") {
  const g = new THREE.Group();
  g.userData.part = "accents";
  if (!items.length) return g;
  const o = new THREE.Object3D();
  if (BEAD_GEMS.has(gem)) {
    const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 20, 14), m.bead(gem, color), items.length);
    items.forEach((it, i) => { orient(o, it); im.setMatrixAt(i, o.matrix); });
    g.add(im);
    return g;
  }
  const asp = ASPECT[shape];
  const geo = cutGeometry(cut, shape, asp, 1, cut === "faceted" ? 0.16 : cut === "rose-cut" ? 0.3 : 0.08);
  const colorless = isColorless(gem, color);
  const tint = cut === "polki" ? 0xfff0c8 : colorless ? 0xf2f5ff : new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.1);
  const meshes = [
    new THREE.InstancedMesh(geo, m.mirror(tint, cut === "polki" ? 2.4 : 3.6), items.length),
    new THREE.InstancedMesh(geo, colorless ? m.skin : m.stone({ gem, cut, color, clarity: 0.8 }, 1), items.length),
    new THREE.InstancedMesh(new THREE.TorusGeometry(0.53, cut === "faceted" ? 0.07 : 0.11, 8, 24).rotateX(Math.PI / 2).scale(1, 1, asp), m.metal, items.length),
  ];
  const prongs = cut === "faceted" ? new THREE.InstancedMesh(new THREE.SphereGeometry(0.09, 8, 6), m.metal, items.length * 4) : null;
  const M = new THREE.Matrix4();
  items.forEach((it, i) => {
    orient(o, it);
    meshes.forEach((x) => x.setMatrixAt(i, o.matrix));
    if (prongs) for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
      M.makeTranslation(Math.cos(a) * 0.5, 0.12, Math.sin(a) * 0.5 * asp);
      prongs.setMatrixAt(i * 4 + k, o.matrix.clone().multiply(M));
    }
  });
  meshes.forEach((x) => g.add(x));
  if (prongs) g.add(prongs);
  return g;
}

/** instanced spheres (beads, gold balls, enamel dots) */
function balls(mat: THREE.Material, items: Item[], squash = 1) {
  const im = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 18, 12).scale(1, squash, 1), mat, Math.max(1, items.length));
  const o = new THREE.Object3D();
  items.forEach((it, i) => { orient(o, it); im.setMatrixAt(i, o.matrix); });
  im.count = items.length;
  return im;
}

/** hanging fringe: from each anchor, a tiny gold link and a drop bead (pearl by default), along `dir` */
function fringe(d: Design, m: Mats, anchors: { pos: THREE.Vector3; dir: THREE.Vector3 }[], beadsPer = 1) {
  const g = new THREE.Group();
  g.userData.part = "fringe";
  if (!d.fringe.enabled || !anchors.length) return g;
  const D = d.fringe.sizeMm;
  const links: Item[] = [], beads: Item[] = [];
  for (const a of anchors) {
    let p = a.pos.clone().addScaledVector(a.dir, 0.6);
    links.push({ pos: p.clone(), dia: Math.max(0.6, D * 0.22) });
    for (let k = 0; k < beadsPer; k++) {
      const dk = D * (1 - k * 0.18);
      p = p.clone().addScaledVector(a.dir, dk * 0.5 + 0.35);
      beads.push({ pos: p.clone(), dia: dk, up: a.dir.clone().normalize() });
      p.addScaledVector(a.dir, dk * 0.5);
    }
  }
  g.add(balls(m.metal, links));
  g.add(balls(m.bead(d.fringe.gem, d.fringe.color), beads, d.fringe.gem === "pearl" ? 1.12 : 1));
  return g;
}

const LINK = { cable: { len: 2.6, wire: 0.42 }, fine: { len: 1.5, wire: 0.22 }, box: { len: 1.8, wire: 0.38 }, rope: { len: 1.6, wire: 0.55 } };

/** chain links along a curve, alternating 90°, between curve params from..to (to may exceed 1 to wrap) */
function chainAlong(curve: THREE.Curve<THREE.Vector3>, style: keyof typeof LINK, m: Mats, from = 0, to = 1) {
  const { len, wire } = LINK[style];
  const total = curve.getLength() * (to - from);
  const n = Math.max(2, Math.floor(total / (len * 0.72)));
  const geo = new THREE.TorusGeometry(len / 2 - wire, wire, style === "box" ? 4 : 8, style === "box" ? 4 : 16).scale(1, 0.62, 1);
  const im = new THREE.InstancedMesh(geo, m.metal, n);
  const o = new THREE.Object3D();
  for (let i = 0; i < n; i++) {
    const u = (((from + ((to - from) * (i + 0.5)) / n) % 1) + 1) % 1;
    o.position.copy(curve.getPointAt(u));
    o.quaternion.setFromUnitVectors(v3(1, 0, 0), curve.getTangentAt(u));
    o.rotateX(style === "rope" ? i * 0.7 : i % 2 ? Math.PI / 2 : 0);
    o.updateMatrix();
    im.setMatrixAt(i, o.matrix);
  }
  return im;
}

function jumpRing(m: Mats, r: number, wire: number, pos: THREE.Vector3) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r, wire, 10, 28), m.metal);
  ring.position.copy(pos);
  ring.rotation.y = Math.PI / 2;
  return ring;
}

/** stones evenly spaced around an outline, offset outward, e.g. a halo */
function aroundOutline(fn: OutlineFn, gap: number, dia: number, spacing: number, y = -0.25): Item[] {
  const N = 480, raw = Array.from({ length: N }, (_, i) => fn(i / N));
  const off = ([x, z]: [number, number]) => { const r = Math.hypot(x, z) || 1; const k = (r + gap + dia / 2) / r; return v3(x * k, y, z * k); };
  const out: Item[] = [];
  let acc = 0, prev = off(raw[0]);
  out.push({ pos: prev, dia });
  for (let i = 1; i < N; i++) {
    const p = off(raw[i]); acc += p.distanceTo(prev); prev = p;
    if (acc >= dia + spacing) { out.push({ pos: p, dia }); acc = 0; }
  }
  if (out.length > 2 && out[out.length - 1].pos.distanceTo(out[0].pos) < dia * 0.9) out.pop();
  return out;
}

function backingPlate(m: Mats, fn: OutlineFn, scale: number, y: number, depth: number, mat?: THREE.Material) {
  const pts = Array.from({ length: 96 }, (_, i) => { const [x, z] = fn(i / 96); return new THREE.Vector2(x * scale, z * scale); });
  const geo = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.15, bevelSegments: 2, curveSegments: 8 });
  geo.rotateX(Math.PI / 2); geo.translate(0, y, 0);
  return new THREE.Mesh(geo, mat ?? m.metal);
}

/* ================= accent patterns ================= */

/** the accent pattern's stones: width and length of each shape at the chosen carat weight */
function patternDims(d: Design, maxW?: number) {
  return d.accents.shapes.map((shape) => {
    const e = estimateDims(d.accents.gem, d.accents.cut, shape, d.accents.sizeCt);
    const W = maxW ? Math.min(e.widthMm, maxW) : e.widthMm;
    return { shape, W, L: W * ASPECT[shape] };
  });
}
const patternMaxW = (d: Design, maxW?: number) => Math.max(...patternDims(d, maxW).map((x) => x.W));

type RunOpts = {
  /** which way the stones face at curve param u (default up, +Y) */
  up?: (u: number) => THREE.Vector3;
  /** extra offset from the curve at u */
  offset?: (u: number) => THREE.Vector3;
  maxW?: number;
  gap?: number;
  /** a full loop: trim to whole repeats of the pattern so it meets itself cleanly */
  closed?: boolean;
};

/**
 * Lay the accent pattern along a curve between params from..to (to may exceed 1 to wrap a closed curve).
 * Honours the repeating shape list and the direction (along / across / alternate), spacing stones by their real footprint.
 */
function patternRun(d: Design, m: Mats, curve: THREE.Curve<THREE.Vector3>, from: number, to: number, opts: RunOpts = {}) {
  const dims = patternDims(d, opts.maxW);
  const orient = d.accents.orientation;
  const along = (i: number) => orient === "along" || (orient === "alternate" && i % 2 === 0);
  const turnOf = (i: number) => THREE.MathUtils.degToRad(d.accents.turns[i % dims.length] ?? 0);
  // extent of a stone along the line and across it, once pointed along/across and given its own turn
  const ext = (s: (typeof dims)[number], i: number) => {
    const a = along(i) ? s.L : s.W, b = along(i) ? s.W : s.L, t = turnOf(i), c = Math.abs(Math.cos(t)), n = Math.abs(Math.sin(t));
    return { line: c * a + n * b, cross: c * b + n * a };
  };
  // stones turned across a narrow band are shrunk so they still fit it
  const fit = (s: (typeof dims)[number], i: number) => { const x = ext(s, i).cross; return opts.maxW && x > opts.maxW ? opts.maxW / x : 1; };
  const foot = (s: (typeof dims)[number], i: number) => ext(s, i).line * fit(s, i);
  const curveLen = curve.getLength();
  const total = curveLen * (to - from);
  const gap = opts.gap ?? Math.max(0.15, Math.min(...dims.map((x) => x.W)) * 0.08);
  const seq: typeof dims = [];
  for (let used = 0, i = 0; i < 2000; i++) {
    const s = dims[i % dims.length];
    if (used + foot(s, i) + (opts.closed ? gap : 0) > total) break;
    seq.push(s); used += foot(s, i) + gap;
  }
  if (opts.closed) {
    const cycle = orient === "alternate" && dims.length % 2 ? dims.length * 2 : dims.length;
    while (seq.length > cycle && seq.length % cycle) seq.pop();
  }
  const usedLen = seq.reduce((a, s, i) => a + foot(s, i), 0) + gap * Math.max(0, seq.length - (opts.closed ? 0 : 1));
  const spare = (total - usedLen) / Math.max(1, opts.closed ? seq.length : seq.length + 1);
  const byShape = new Map<string, Item[]>();
  let at = opts.closed ? 0 : spare;
  const basis = new THREE.Matrix4();
  seq.forEach((s, i) => {
    const f = foot(s, i);
    const u = wrap(from + (at + f / 2) / curveLen);
    const up = (opts.up?.(u) ?? Y).clone().normalize();
    const t = curve.getTangentAt(u);
    const tp = t.clone().addScaledVector(up, -t.dot(up)).normalize();
    const Z = along(i) ? tp : new THREE.Vector3().crossVectors(up, tp).normalize();
    const X = new THREE.Vector3().crossVectors(up, Z).normalize();
    basis.makeBasis(X, up, Z);
    const pos = curve.getPointAt(u).add(opts.offset?.(u) ?? new THREE.Vector3());
    const quat = new THREE.Quaternion().setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromAxisAngle(Y, turnOf(i)));
    (byShape.get(s.shape) ?? byShape.set(s.shape, []).get(s.shape)!).push({ pos, dia: s.W * fit(s, i), quat });
    at += f + gap + spare;
  });
  const g = new THREE.Group();
  byShape.forEach((items, shape) => g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, items, shape as CenterStone["shape"])));
  return { group: g, maxW: Math.max(...dims.map((x) => x.W)), count: seq.length };
}

/**
 * The accent pattern at fixed spots (graduated climbers, stations, wings): shapes cycle through the pattern,
 * each spot keeps its own width, and elongated stones point along or across `tan`.
 */
function patternAt(d: Design, m: Mats, spots: { pos: THREE.Vector3; dia: number; tan: THREE.Vector3; up?: THREE.Vector3 }[]) {
  const orient = d.accents.orientation;
  const byShape = new Map<string, Item[]>();
  const basis = new THREE.Matrix4();
  spots.forEach((sp, i) => {
    const shape = d.accents.shapes[i % d.accents.shapes.length];
    const along = orient === "along" || (orient === "alternate" && i % 2 === 0);
    const up = (sp.up ?? Y).clone().normalize();
    const tp = sp.tan.clone().addScaledVector(up, -sp.tan.dot(up)).normalize();
    const Z = along ? tp : new THREE.Vector3().crossVectors(up, tp).normalize();
    basis.makeBasis(new THREE.Vector3().crossVectors(up, Z).normalize(), up, Z);
    const turn = THREE.MathUtils.degToRad(d.accents.turns[i % d.accents.shapes.length] ?? 0);
    (byShape.get(shape) ?? byShape.set(shape, []).get(shape)!).push({ pos: sp.pos, dia: sp.dia, quat: new THREE.Quaternion().setFromRotationMatrix(basis).multiply(new THREE.Quaternion().setFromAxisAngle(Y, turn)) });
  });
  const g = new THREE.Group();
  byShape.forEach((items, shape) => g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, items, shape as CenterStone["shape"])));
  return g;
}

/** a closed curve following a stone's outline, pushed outward by `gap` */
function outlineCurve(c: CenterStone, gap: number, y: number) {
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
  const pts = Array.from({ length: 160 }, (_, i) => {
    const [x, z] = fn(i / 160); const r = Math.hypot(x, z) || 1; const k = (r + gap) / r;
    return v3(x * k, y, z * k);
  });
  return new THREE.CatmullRomCurve3(pts, true, "centripetal");
}

/** halo of accents around the main stone, on a gold rim */
function halo(d: Design, m: Mats, c: CenterStone, rings = 1) {
  const g = new THREE.Group();
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
  const dia = patternMaxW(d);
  let gap = 0.45;
  for (let r = 0; r < rings; r++) {
    g.add(patternRun(d, m, outlineCurve(c, gap + dia / 2, -0.25), 0, 1, { closed: true, gap: 0.22 }).group);
    gap += dia + 0.3;
  }
  const r0 = Math.max(c.lengthMm, c.widthMm) / 2;
  g.add(backingPlate(m, fn, (r0 + gap) / r0, -0.35, 0.7));
  return { group: g, extent: gap };
}

/** kundan flower: centre stone, a ring of petal stones, a gold plate, optional enamel rim */
function flower(d: Design, m: Mats, c: CenterStone, scale = 1) {
  const g = new THREE.Group();
  g.add(setStone(c, "bezel", m, scale));
  const R = (Math.max(c.lengthMm, c.widthMm) * scale) / 2;
  const petal = Math.max(1.4, R * 0.75);
  const n = Math.max(6, Math.round((2 * Math.PI * (R + petal / 2 + 0.5)) / (petal + 0.4)));
  const items: Item[] = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2;
    return { pos: v3(Math.cos(a) * (R + petal / 2 + 0.6), -0.2, Math.sin(a) * (R + petal / 2 + 0.6)), dia: petal };
  });
  g.add(accents(m, d.accents.gem, d.accents.color, d.accents.gem === "diamond" ? "polki" : d.accents.cut, items));
  const outer = R + petal + 1.1;
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(outer, outer, 0.8, 64), m.metal);
  plate.position.y = -0.75;
  g.add(plate);
  if (d.enamel.enabled) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(outer + 0.9, outer + 0.9, 0.5, 64), m.enamel);
    rim.position.y = -1.1;
    g.add(rim);
  }
  g.add(balls(m.metal, Array.from({ length: Math.round(outer * 4) }, (_, i) => { const a = (i / Math.round(outer * 4)) * Math.PI * 2; return { pos: v3(Math.cos(a) * outer, -0.4, Math.sin(a) * outer), dia: 0.45 }; })));
  return { group: g, radius: outer + (d.enamel.enabled ? 0.9 : 0) };
}

/** gold coin (temple jewellery): disc, beaded rim, raised centre */
function coin(m: Mats, r: number) {
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.7, 48), m.metal);
  disc.position.y = -0.35;
  g.add(disc);
  g.add(balls(m.metal, Array.from({ length: Math.round(r * 7) }, (_, i) => { const a = (i / Math.round(r * 7)) * Math.PI * 2; return { pos: v3(Math.cos(a) * r * 0.86, 0.05, Math.sin(a) * r * 0.86), dia: 0.42 }; })));
  const boss = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.metal);
  boss.scale.y = 0.35;
  g.add(boss);
  return g;
}

/** jhumka bell lying on its side, opening toward +Z */
function bell(d: Design, m: Mats, R: number) {
  const g = new THREE.Group();
  const prof = [[0.4, 0], [R * 0.3, R * 0.05], [R * 0.62, R * 0.25], [R * 0.86, R * 0.6], [R * 0.98, R * 1.0], [R, R * 1.12]].map(([x, y]) => new THREE.Vector2(x, y));
  const geo = new THREE.LatheGeometry(prof, 64);
  const outer = new THREE.Mesh(geo, m.metal);
  const inner = new THREE.Mesh(geo, d.enamel.enabled ? m.enamel : m.metal);
  (inner.material as THREE.Material).side = THREE.BackSide;
  const inside = new THREE.Mesh(geo, inner.material.clone());
  (inside.material as THREE.Material).side = THREE.BackSide;
  g.add(outer, inside);
  // rim stones and ribs
  const rimR = R * 0.93 + 0.2;
  const rim = new THREE.CatmullRomCurve3(Array.from({ length: 96 }, (_, i) => { const a = (i / 96) * Math.PI * 2; return v3(Math.cos(a) * rimR, R * 0.82, Math.sin(a) * rimR); }), true);
  const rimRun = patternRun(d, m, rim, 0, 1, { closed: true, maxW: R * 0.25, gap: 0.3, up: (u) => rim.getPointAt(u).setY(0).normalize() });
  g.add(rimRun.group);
  const n = Math.max(12, rimRun.count);
  g.add(balls(m.metal, Array.from({ length: n * 2 }, (_, i) => { const a = (i / (n * 2)) * Math.PI * 2; return { pos: v3(Math.cos(a) * R, R * 1.12, Math.sin(a) * R), dia: 0.55 }; })));
  g.rotation.x = Math.PI / 2; // axis Y → Z (opening toward +Z)
  return { group: g, rimZ: R * 1.12, R };
}

/* ================= curves ================= */

/** a closed loop of the given length; aspect widens it, point makes a soft V at the front (+Z) */
function loopCurve(lengthMm: number, aspect: number, point: number) {
  const make = (k: number) => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < 96; i++) {
      const t = (i / 96) * Math.PI * 2;
      const x = Math.cos(t) * k * aspect;
      let z = Math.sin(t) * k;
      if (z > 0) z += point * k * Math.pow(Math.max(0, 1 - Math.abs(x) / (k * aspect)), 2);
      pts.push(v3(x, 0, z));
    }
    return new THREE.CatmullRomCurve3(pts, true, "centripetal");
  };
  let k = lengthMm / (2 * Math.PI);
  for (let i = 0; i < 4; i++) k *= lengthMm / make(k).getLength();
  const curve = make(k);
  let front = 0, bz = -Infinity;
  for (let i = 0; i < 400; i++) { const p = curve.getPointAt(i / 400); if (p.z > bz) { bz = p.z; front = i / 400; } }
  return { curve, front };
}
/** a longer loop shifted so its back (clasp) lines up with the base loop's back: layered strands fall progressively lower */
function layeredLoop(baseLen: number, extra: number, aspect: number, point: number) {
  const base = loopCurve(baseLen, aspect, point);
  const lay = loopCurve(baseLen + extra, aspect, point);
  const back = (cv: THREE.Curve<THREE.Vector3>) => { let z = Infinity; for (let i = 0; i < 200; i++) z = Math.min(z, cv.getPointAt(i / 200).z); return z; };
  const dz = back(base.curve) - back(lay.curve);
  const pts = lay.curve.getSpacedPoints(160).slice(0, -1).map((p) => p.add(new THREE.Vector3(0, 0, dz)));
  const curve = new THREE.CatmullRomCurve3(pts, true, "centripetal");
  let front = 0, bz = -Infinity;
  for (let i = 0; i < 400; i++) { const p = curve.getPointAt(i / 400); if (p.z > bz) { bz = p.z; front = i / 400; } }
  return { curve, front };
}
const wrap = (u: number) => ((u % 1) + 1) % 1;
const outwardAt = (curve: THREE.Curve<THREE.Vector3>, u: number) => new THREE.Vector3().crossVectors(Y, curve.getTangentAt(wrap(u))).normalize();
const yawAt = (curve: THREE.Curve<THREE.Vector3>, u: number) => { const t = curve.getTangentAt(wrap(u)); return Math.atan2(t.x, t.z) + Math.PI / 2; };

/** evenly spaced params centred on `front`, spanning `spread` of the loop */
const spreadParams = (front: number, count: number, spread: number) =>
  Array.from({ length: count }, (_, i) => wrap(front + (count === 1 ? 0 : (i / (count - 1) - 0.5) * spread)));

function place(obj: THREE.Object3D, pos: THREE.Vector3, yaw = 0, up?: THREE.Vector3) {
  obj.position.copy(pos);
  if (up) obj.quaternion.setFromUnitVectors(Y, up);
  obj.rotateY(yaw);
  return obj;
}

/** a strand of beads along a loop, optionally with a gold bead every nth */
function beadStrand(m: Mats, curve: THREE.Curve<THREE.Vector3>, gem: Gem, color: string, dia: number, goldEvery = 0, from = 0, to = 1) {
  const len = curve.getLength() * (to - from);
  const n = Math.floor(len / (dia * 1.04));
  const beads: Item[] = [], gold: Item[] = [];
  for (let i = 0; i < n; i++) {
    const u = wrap(from + ((to - from) * (i + 0.5)) / n);
    (goldEvery && i % goldEvery === 0 ? gold : beads).push({ pos: curve.getPointAt(u), dia });
  }
  const g = new THREE.Group();
  g.add(balls(m.bead(gem, color), beads));
  if (gold.length) g.add(balls(m.metal, gold));
  return g;
}

/** a custom motif: gold plate with its stones, top face at y = 0, the drawing's bottom toward +Z */
function motif(d: Design, m: Mats, scale = 1) {
  const mo = { ...d.motif, widthMm: d.motif.widthMm * scale };
  const g = motifPlate(mo, m.metal, d.enamel.enabled ? m.enamel : null);
  const ms = motifShapes(mo);
  const k = ms?.scale ?? mo.widthMm / 100;
  const at = (x: number, y: number) => (ms ? ms.toLocal(x, y) : v3((x - 50) * k, 0, (y - 50) * k));
  const acc: Item[] = [];
  for (const st of mo.stones) {
    const pos = at(st.x, st.y), dia = st.r * 2 * k;
    if (st.kind === "center") {
      const c = d.center, longest = Math.max(c.lengthMm, c.widthMm);
      const s = setStone(c, d.setting.style, m, dia / longest);
      s.position.copy(pos).add(v3(0, 0.15, 0));
      g.add(s);
    } else acc.push({ pos: pos.add(v3(0, 0.1, 0)), dia });
  }
  g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, acc));
  const box = new THREE.Box3().setFromObject(g);
  return { group: g, top: box.min.z, bottom: box.max.z, width: box.max.x - box.min.x };
}

function motifPiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  if (d.type === "ring") {
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    group.add(new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish), m.metal));
    const mo = motif(d, m);
    mo.group.position.y = RIN + 2.3 + d.motif.thicknessMm + 0.3;
    group.add(mo.group);
    // posts joining the plate to the shank
    for (const sx of [-1, 1]) group.add(tube(m, [v3(sx * 1.6, RIN + 2.1, 0), v3(sx * 2.4, RIN + 2.3 + 0.3, 0)], 0.7));
    return { group, focus: v3(0, mo.group.position.y, 0), focusSize: Math.max(18, mo.width * 1.6), upright: true };
  }
  if (d.type === "earrings") {
    const one = new THREE.Group();
    const dia = Math.max(3, roundDiameter(d.accents.gem, d.accents.sizeCt) * 1.4);
    one.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: v3(), dia }]));
    one.add(jumpRing(m, 0.9, 0.24, v3(0, -0.2, dia / 2 + 0.7)));
    const mo = motif(d, m);
    mo.group.position.z = dia / 2 + 1.6 - mo.top;
    one.add(mo.group);
    const bottom = mo.group.position.z + mo.bottom;
    one.add(fringe(d, m, Array.from({ length: 5 }, (_, i) => ({ pos: v3((i / 4 - 0.5) * mo.width * 0.5, 0, bottom), dir: v3(0, 0, 1) })), 2));
    const gap = mo.width + 10;
    const right = one.clone();
    one.position.x = -gap / 2; right.position.x = gap / 2;
    group.add(one, right);
    return { group, focus: v3(-gap / 2, 0, mo.group.position.z), focusSize: mo.width * 2.2, upright: false };
  }
  const isNecklace = d.type === "necklace";
  const { curve, front } = loopCurve(isNecklace ? d.options.lengthIn * 25.4 : d.options.wristCm * 10 + 15, isNecklace ? 0.85 : 1.12, isNecklace && d.style === "motif-pendant" ? 0.22 : 0.05);
  const fp = curve.getPointAt(front);
  group.add(chainAlong(curve, d.options.chain, m));
  if (d.style === "motif-pendant") {
    const mo = motif(d, m);
    group.add(jumpRing(m, 1.2, 0.35, fp.clone().add(v3(0, 0, 1.2))));
    mo.group.position.copy(fp).add(v3(0, 0, 2.6 - mo.top));
    group.add(mo.group);
    const bottom = mo.group.position.z + mo.bottom;
    group.add(fringe(d, m, Array.from({ length: 7 }, (_, i) => ({ pos: v3((i / 6 - 0.5) * mo.width * 0.6, 0, bottom), dir: v3(0, 0, 1) })), 2));
    return { group, focus: mo.group.position.clone(), focusSize: mo.width * 2.4, upright: false };
  }
  const n = Math.max(1, d.options.count);
  const params = isNecklace ? spreadParams(front, n, 0.55) : Array.from({ length: n }, (_, i) => wrap(front + i / n));
  let size = 20;
  for (const u of params) {
    const mo = motif(d, m, isNecklace ? 0.6 : 0.5);
    const out = outwardAt(curve, u);
    // turn the motif so its top meets the chain and it hangs outward
    place(mo.group, curve.getPointAt(u).addScaledVector(out, -mo.top * 0.9), Math.atan2(out.x, out.z));
    group.add(mo.group);
    size = mo.width;
  }
  return { group, focus: fp, focusSize: size * 4, upright: false };
}

/* ================= pieces ================= */

function ringPiece(d: Design): Piece {
  const m = makeMaterials(d);
  const st = d.style;
  if (st === "eternity") {
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    const band = new THREE.Mesh(shankGeo(RIN, Math.max(d.band.widthMm, 2.6), "polished"), m.metal);
    group.add(band);
    const Ro = RIN + 1.75;
    const circle = new THREE.CatmullRomCurve3(Array.from({ length: 128 }, (_, i) => { const a = (i / 128) * Math.PI * 2; return v3(Math.sin(a) * Ro, Math.cos(a) * Ro, 0); }), true);
    group.add(patternRun(d, m, circle, 0, 1, { closed: true, maxW: Math.max(d.band.widthMm, 2.6) * 0.9, up: (u) => circle.getPointAt(u).normalize(), offset: (u) => circle.getPointAt(u).normalize().multiplyScalar(0.05), gap: 0.25 }).group);
    return { group, focus: v3(0, Ro, 0), focusSize: 18, upright: true };
  }
  if (d.center.none) {
    // a plain band
    const group = new THREE.Group();
    const RIN = ringInnerDiameter(d.ringSize) / 2;
    group.add(new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish), m.metal));
    return { group, focus: v3(0, RIN, 0), focusSize: 24, upright: true };
  }
  const base = st === "three-stone" || st === "halo" ? d : { ...d, sides: { ...d.sides, kind: "none" as const } };
  const group = buildRing(base);
  if (st === "two-stone" && d.extraStones[0]) {
    // toi-et-moi: shift the main stone's head aside and set the partner stone beside it
    const e = d.extraStones[0];
    const head: THREE.Group | undefined = group.userData.head;
    const reach = (L: number, W: number, deg: number) => { const r = THREE.MathUtils.degToRad(deg); return (Math.abs(Math.cos(r)) * W + Math.abs(Math.sin(r)) * L) / 2; };
    const a = reach(d.center.lengthMm, d.center.widthMm, d.center.rotation), b = reach(e.lengthMm, e.widthMm, e.rotation);
    if (head) head.position.x = -(a + 0.4);
    const gy0: number = group.userData.girdleY ?? 12;
    const mm = makeMaterials(d);
    const partner = setStoneRaw({ ...d.center, ...e, carat: null, label: "", photoPath: null, rotation: 0, none: false }, d.setting.style, mm);
    partner.rotation.y = THREE.MathUtils.degToRad(e.rotation);
    partner.position.set(b + 0.4 + e.dx, gy0, e.dz);
    partner.userData.part = "extra";
    group.add(partner);
    // a bridge under both stones into the shank
    group.add(tube(mm, [v3(-(a + 0.4), gy0 - 1.6, 0), v3(0, gy0 - 2.4, 0), v3(b + 0.4 + e.dx, gy0 - 1.6, e.dz)], 0.6));
    const top = new THREE.Box3().setFromObject(group).max.y;
    return { group, focus: v3(0, top - d.center.domeMm - 1, 0), focusSize: 30, upright: true };
  }
  const gy: number = group.userData.girdleY ?? 12;
  const c = d.center;
  const fn = outlineFn(c.shape, c.lengthMm, c.widthMm);
  const at = (o: THREE.Object3D) => { o.position.y += gy; group.add(o); };
  if (st === "halo") at(halo(d, m, c).group);
  if (st === "polki-cocktail") {
    const h = halo(d, m, c, 2);
    at(h.group);
    if (d.fringe.enabled) {
      const dia = d.fringe.sizeMm * 0.8;
      at(balls(m.bead(d.fringe.gem, d.fringe.color), aroundOutline(fn, h.extent + 0.2, dia, 0.15, -0.3)));
    }
  }
  if (st === "cluster") {
    const dia = patternMaxW(d);
    at(patternRun(d, m, outlineCurve(c, 0.35 + dia / 2, -0.6), 0, 1, { closed: true, gap: 0.15 }).group);
  }
  if (st === "navratna") {
    // traditional order around the ruby (sun): diamond, pearl, coral, hessonite, blue sapphire, cat's eye, yellow sapphire, emerald
    const ring: [Gem, string][] = [["diamond", "#f4f6fb"], ["pearl", "#f3ede2"], ["coral", "#e2553a"], ["hessonite", "#c8641c"], ["sapphire", "#0c2394"], ["cats-eye", "#b9a24a"], ["yellow-sapphire", "#f2c230"], ["emerald", "#0b7a4b"]];
    const R = Math.max(c.lengthMm, c.widthMm) / 2;
    const dia = Math.max(2.4, R * 0.95);
    ring.forEach(([gem, color], i) => {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      at(accents(m, gem, color, "faceted", [{ pos: v3(Math.cos(a) * (R + dia / 2 + 0.5), -0.4, Math.sin(a) * (R + dia / 2 + 0.5)), dia }]));
    });
    at(backingPlate(m, outlineFn("round", 1, 1), (R + dia + 1) * 2, -0.9, 0.8));
  }
  const top = new THREE.Box3().setFromObject(group).max.y;
  return { group, focus: v3(0, top - c.domeMm - 1, 0), focusSize: 26, upright: true };
}

/** one stud: the main stone (with optional halo) and any extra stones stacked below it, joined underneath */
function stud(d: Design, m: Mats, mirror: boolean) {
  const g = new THREE.Group();
  const flip = mirror ? -1 : 1;
  const c = d.center;
  const main = new THREE.Group();
  main.add(setStoneRaw(c, d.setting.style, m));
  if (d.options.halo) main.add(halo(d, m, c).group);
  main.rotation.y = THREE.MathUtils.degToRad(c.rotation * flip);
  g.add(main);
  // extent of a stone along Z once it is turned
  const reach = (L: number, W: number, deg: number) => { const r = THREE.MathUtils.degToRad(deg); return (Math.abs(Math.cos(r)) * L + Math.abs(Math.sin(r)) * W) / 2; };
  let z = reach(c.lengthMm, c.widthMm, c.rotation) + (d.options.halo ? roundDiameter(d.accents.gem, d.accents.sizeCt) + 0.8 : 0);
  let prev = new THREE.Vector3();
  for (const e of d.extraStones) {
    const stone: CenterStone = { ...c, ...e, domeMm: e.cut === "faceted" ? Math.max(e.domeMm, Math.min(e.widthMm, e.lengthMm) * 0.15) : e.domeMm, carat: null, label: "", photoPath: null, rotation: 0 };
    const half = reach(e.lengthMm, e.widthMm, e.rotation);
    const pos = new THREE.Vector3(e.dx * flip, 0, z + 0.4 + half + e.dz);
    const s = setStoneRaw(stone, d.setting.style, m);
    s.rotation.y = THREE.MathUtils.degToRad(e.rotation * flip);
    s.position.copy(pos);
    s.userData.part = "extra";
    g.add(s);
    // a hidden gold bridge between neighbouring stones
    g.add(tube(m, [prev.clone().setY(-1.1), pos.clone().setY(-1.1)], 0.45));
    prev = pos;
    z = pos.z + half;
  }
  return g;
}

/**
 * Hoops and huggies stand upright like a real pair: an oval-section wire opening at the top with a hinged post,
 * stones set into the front face, and (hoops) an optional charm hanging from the bottom. Front faces +Z.
 */
function hoopEarring(d: Design, m: Mats, huggie: boolean) {
  const g = new THREE.Group();
  const R = (huggie ? Math.min(d.options.hoopDiameterMm, 16) : d.options.hoopDiameterMm) / 2;
  const stoneW = d.options.pave ? patternMaxW(d, huggie ? 3.6 : 2.8) : 0;
  const sideSet = d.options.pave && d.options.hoopFace !== "front";
  const T = sideSet ? (huggie ? 2.4 : 1.4) : Math.max(huggie ? 2.6 : 1.5, stoneW + (huggie ? 0.8 : 0.6)); // width seen from the front
  const D = sideSet ? Math.max(huggie ? 3 : 1.8, stoneW + 0.6) : huggie ? Math.max(3, T * 1.1) : Math.max(1.6, T * 0.9); // depth, front to back
  const gapA = Math.max(0.12, 1.4 / R);
  // round; a tall oval; or a long paperclip (a rounded rectangle), hanging from the top
  const hs = d.options.hoopShape;
  const rx = hs === "round" ? R : hs === "oval" ? R * 0.72 : R * 0.5, ry = hs === "round" ? R : hs === "oval" ? R * 1.25 : R * 1.45;
  const ex = hs === "paperclip" ? 0.45 : 1;
  const arc = new THREE.CatmullRomCurve3(Array.from({ length: 160 }, (_, i) => {
    const a = Math.PI / 2 + gapA + (i / 159) * (2 * Math.PI - 2 * gapA);
    const c = Math.cos(a), sn = Math.sin(a);
    return v3(Math.sign(c) * Math.pow(Math.abs(c), ex) * rx, Math.sign(sn) * Math.pow(Math.abs(sn), ex) * ry - (ry - R), 0);
  }));
  const wire = new THREE.Mesh(new THREE.TubeGeometry(arc, 240, T / 2, 20, false), m.metal);
  wire.scale.z = D / T;
  g.add(wire);
  // rounded ends, the post across the opening and the hinge knuckle
  const endA = arc.getPointAt(0), endB = arc.getPointAt(1);
  for (const e of [endA, endB]) { const cap = new THREE.Mesh(new THREE.SphereGeometry(T / 2, 16, 12), m.metal); cap.scale.z = D / T; cap.position.copy(e); g.add(cap); }
  g.add(tube(m, [endB.clone(), endB.clone().lerp(endA, 0.5).add(v3(0, 0.25, 0)), endA.clone()], Math.min(0.42, T * 0.2)));
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(T * 0.42, T * 0.42, D * 0.9, 16), m.metal);
  knuckle.rotation.x = Math.PI / 2; knuckle.position.copy(endB);
  g.add(knuckle);
  if (d.options.pave) {
    const span = { front: [0.14, 0.86], half: [0.25, 0.75], full: [0.03, 0.97] }[d.options.paveCoverage];
    const face = d.options.hoopFace;
    // front: the narrow face you see head-on; outer/inner: the wide sides of the wire
    // outward normal of the hoop in its own plane (works for ovals and paperclips too)
    const radial = (u: number) => { const t = arc.getTangentAt(u); return v3(t.y, -t.x, 0).normalize(); };
    const opts: RunOpts = face === "front"
      ? { up: () => v3(0, 0, 1), offset: () => v3(0, 0, D / 2 - 0.05), maxW: T - 0.4, gap: 0.12 }
      : face === "outer"
      ? { up: radial, offset: (u) => radial(u).multiplyScalar(T / 2 - 0.05), maxW: D - 0.4, gap: 0.12 }
      : { up: (u) => radial(u).negate(), offset: (u) => radial(u).multiplyScalar(-(T / 2 - 0.05)), maxW: D - 0.4, gap: 0.12 };
    g.add(patternRun(d, m, arc, span[0], span[1], opts).group);
  }
  if (!huggie && d.fringe.enabled) {
    // a crescent of seed pearls (or beads) clustered over the front of the hoop, fullest at the bottom
    const beads: Item[] = [];
    const D0 = d.fringe.sizeMm;
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const u0 = 0.3, u1 = 0.7;
    for (let u = u0; u <= u1; u += D0 * 0.5 / arc.getLength()) {
      const k = Math.sin(((u - u0) / (u1 - u0)) * Math.PI);
      const rows = 1 + Math.round(k * 3);
      const p0 = arc.getPointAt(u), nrm = (() => { const t = arc.getTangentAt(u); return v3(t.y, -t.x, 0).normalize(); })();
      for (let r = 0; r < rows; r++) {
        const dia = D0 * (0.65 + rnd() * 0.5) * (0.75 + 0.25 * k);
        const out = (r - (rows - 1) / 2) * D0 * 0.62 + (rnd() - 0.5) * D0 * 0.2;
        beads.push({ pos: p0.clone().addScaledVector(nrm, out).add(v3(0, 0, D / 2 + dia * 0.25 + Math.abs(out) * -0.15)), dia });
      }
    }
    const cluster = balls(m.bead(d.fringe.gem, d.fringe.color), beads, d.fringe.gem === "pearl" ? 1 : 0.95);
    const cg = new THREE.Group(); cg.userData.part = "fringe"; cg.add(cluster);
    g.add(cg);
  }
  const box = new THREE.Box3().setFromObject(g);
  let low = Math.min(-R - T / 2, box.min.y);
  if (!huggie && !d.center.none) {
    const c = d.center;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.24, 10, 24), m.metal);
    ring.position.set(0, low - 0.6, 0);
    g.add(ring);
    const charm = setStone(c, d.setting.style, m);
    const holder = new THREE.Group();
    holder.add(charm);
    if (c.shape === "pear" || c.shape === "heart") charm.rotateY(Math.PI); // narrow end up
    holder.rotation.x = Math.PI / 2; // face forward, length hanging down
    const turn = new THREE.Group();
    turn.rotation.y = THREE.MathUtils.degToRad(d.options.charmTurn);
    turn.position.set(0, low - 1.8 - c.lengthMm / 2, 0);
    turn.add(holder);
    g.add(turn);
    low -= 1.8 + c.lengthMm;
  }
  return { group: g, R, T, low };
}

function hoopPair(d: Design, m: Mats, huggie: boolean, rd: Design | null = null): Piece {
  const left = hoopEarring(d, m, huggie), right = hoopEarring(rd ?? d, m, (rd ?? d).style === "huggie");
  left.group.userData.ear = "left"; right.group.userData.ear = "right";
  const sep = Math.max(left.R + left.T, right.R + right.T) + 6;
  left.group.position.x = -sep; left.group.rotation.y = 0.35;
  right.group.position.x = sep; right.group.rotation.y = -0.35;
  const group = new THREE.Group();
  group.add(left.group, right.group);
  return { group, focus: v3(-sep, (left.low + left.R) / 2, 0), focusSize: (left.R + left.T) * 2.6 + (left.R - left.low), upright: true };
}

/* ================= drops, chandeliers and drop pendants, part by part ================= */

const PAVE_CUTS = new Set(["faceted", "polki", "rose-cut"]);
const briolRatio = (shape: CenterStone["shape"], cut: CenterStone["cut"]) => (cut === "briolette" ? 2 : ASPECT[shape]);

/** the accent settings swapped for a drop part's own small stones, so halos and pavé reuse the pattern engine */
function paveDesign(d: Design, p: DropPart): Design {
  const cut = PAVE_CUTS.has(p.small.cut) ? (p.small.cut as "faceted" | "polki" | "rose-cut") : "faceted";
  return { ...d, accents: { ...d.accents, gem: p.small.gem, color: p.small.color, cut, sizeCt: 6, shapes: [p.haloShape], orientation: "along", turns: [] } };
}
function partStone(d: Design, p: DropPart): CenterStone {
  // a faceted stone needs a real crown or its facets all mirror the same light and it reads flat grey
  const domeMm = p.stone.cut === "faceted" ? Math.max(p.stone.domeMm, Math.min(p.stone.widthMm, p.stone.lengthMm) * 0.15) : p.stone.domeMm;
  return { ...d.center, ...p.stone, domeMm, carat: null, label: "", photoPath: null, none: false, rotation: 0 };
}
function smallStone(d: Design, p: DropPart, shape: CenterStone["shape"]): CenterStone {
  const W = p.small.widthMm, cut = p.small.cut;
  return {
    ...d.center, gem: p.small.gem, cut, shape, widthMm: W, lengthMm: W * briolRatio(shape, cut), domeMm: cut === "cabochon" ? W * 0.4 : W * 0.16,
    color: p.small.color, clarity: COLORLESS.has(p.small.gem) ? 0.95 : 0.6, carat: null, label: "", photoPath: null, none: false, rotation: 0,
  };
}
const setFor = (d: Design, c: CenterStone) => (c.cut === "cabochon" ? "bezel" : Math.max(c.lengthMm, c.widthMm) < 4.5 ? "four-claw" : d.setting.style);

type Built = { g: THREE.Group; top?: number; hang?: number };

/** one stone with an optional halo and petals or leaves */
function dropStonePart(d: Design, m: Mats, p: DropPart): Built {
  const g = new THREE.Group();
  const cs = partStone(d, p);
  const theta = THREE.MathUtils.degToRad(p.stone.rotation);
  const core = new THREE.Group();
  let Lh = 1, Wh = 1;
  if (p.showStone) {
    core.add(setStoneRaw(cs, setFor(d, cs), m));
    Lh = cs.lengthMm / 2; Wh = cs.widthMm / 2;
    if (p.halo) {
      const pd = paveDesign(d, p);
      core.add(patternRun(pd, m, outlineCurve(cs, 0.35 + p.haloMm / 2, -0.25), 0, 1, { closed: true, gap: 0.16, maxW: p.haloMm }).group);
      const r0 = Math.max(Lh, Wh);
      core.add(backingPlate(m, outlineFn(cs.shape, cs.lengthMm, cs.widthMm), (r0 + p.haloMm + 0.5) / r0, -0.5, 0.6));
      Lh += p.haloMm + 0.45; Wh += p.haloMm + 0.45;
    }
  } else {
    core.add(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), m.metal));
  }
  core.rotation.y = theta;
  g.add(core);

  const n = p.count;
  if (n > 0) {
    const angles: number[] = [];
    const fan = (centre: number, k: number, step: number) => { for (let i = 0; i < k; i++) angles.push(centre + (i - (k - 1) / 2) * step); };
    if (p.arrange === "around") for (let i = 0; i < n; i++) angles.push(-Math.PI / 2 + (2 * Math.PI * i) / n);
    else if (p.arrange === "above") fan(-Math.PI / 2, n, Math.min(0.62, (Math.PI * 0.9) / Math.max(1, n - 1)));
    else if (p.arrange === "below") fan(Math.PI / 2, n, Math.min(0.62, (Math.PI * 0.9) / Math.max(1, n - 1)));
    else { const left = Math.ceil(n / 2); fan(Math.PI - 0.5, left, -0.48); fan(0.5, n - left, 0.48); }
    const rot = THREE.MathUtils.degToRad(p.small.rotation);
    angles.forEach((phi, i) => {
      const dir = v3(Math.cos(phi), 0, Math.sin(phi));
      // the stone's edge in this direction (an ellipse, turned with the stone)
      const lx = dir.x * Math.cos(-theta) + dir.z * Math.sin(-theta), lz = -dir.x * Math.sin(-theta) + dir.z * Math.cos(-theta);
      const rEdge = 1 / Math.sqrt((lx / Wh) ** 2 + (lz / Lh) ** 2);
      const slot = i % p.small.shapes.length, shape = p.small.shapes[slot];
      const sc = smallStone(d, p, shape);
      const own = THREE.MathUtils.degToRad(p.small.turns[slot] ?? 0);
      const pos = dir.clone().multiplyScalar(rEdge + 0.3 + sc.lengthMm / 2);
      const s = setStoneRaw(sc, setFor(d, sc), m);
      s.position.copy(pos).setY(-0.15);
      s.rotation.y = Math.atan2(dir.x, dir.z) + (dir.x < -1e-6 ? -(rot + own) : rot + own);
      g.add(s);
      g.add(tube(m, [v3(0, -0.9, 0), pos.clone().setY(-0.9)], 0.3));
    });
  }
  return { g };
}

/** a bar with strands of stones hanging from it */
function dropStrandsPart(d: Design, m: Mats, p: DropPart): Built {
  const g = new THREE.Group();
  const n = Math.max(1, p.count);
  const spread = n > 1 ? p.spreadMm : 0;
  const barZ = (x: number) => (spread ? p.curveMm * (1 - 4 * (x / spread) ** 2) : 0);
  if (n > 1) {
    const bar = new THREE.CatmullRomCurve3(Array.from({ length: 25 }, (_, i) => { const x = (i / 24 - 0.5) * spread; return v3(x, -0.3, barZ(x)); }));
    g.add(new THREE.Mesh(new THREE.TubeGeometry(bar, 60, 0.28, 8, false), m.metal));
    // the two wires from the hanging point to the bar's ends
    g.add(tube(m, [v3(0, -0.3, -1.6), v3(-spread / 2, -0.3, 0)], 0.22), tube(m, [v3(0, -0.3, -1.6), v3(spread / 2, -0.3, 0)], 0.22));
    if (p.barStones) {
      const pd = paveDesign(d, p);
      g.add(patternRun(pd, m, bar, 0, 1, { gap: 0.2, maxW: p.haloMm, offset: () => v3(0, 0.25, 0) }).group);
    }
  }
  const mid = (n - 1) / 2;
  let hang: number | undefined;
  for (let i = 0; i < n; i++) {
    if (p.openMiddle && n % 2 === 1 && i === mid) continue;
    const t = n > 1 ? i / (n - 1) - 0.5 : 0, x = t * spread;
    const k = Math.abs(t) * 2;
    const extra = (p.taper === "v" ? 1 - k : p.taper === "u" ? k : 0) * p.small.widthMm * 1.6;
    let z = barZ(x) + 0.3;
    g.add(jumpRing(m, 0.55, 0.16, v3(x, -0.3, z + 0.3)));
    z += 0.7;
    if (extra > 0.2) { g.add(tube(m, [v3(x, -0.3, z - 0.2), v3(x, -0.3, z + extra)], 0.16)); z += extra; }
    for (let j = 0; j < p.perStrand; j++) {
      const slot = j % p.small.shapes.length;
      const sc = smallStone(d, p, p.small.shapes[slot]);
      const s = setStoneRaw(sc, setFor(d, sc), m);
      const turn = THREE.MathUtils.degToRad(p.small.rotation + (p.small.turns[slot] ?? 0));
      s.rotation.y = turn;
      // a turned stone takes up less (or more) room down the strand
      const tall = Math.abs(Math.cos(turn)) * sc.lengthMm + Math.abs(Math.sin(turn)) * sc.widthMm;
      s.position.set(x, 0, z + tall / 2);
      g.add(s);
      z += tall;
      if (j < p.perStrand - 1) { g.add(jumpRing(m, 0.45, 0.14, v3(x, -0.2, z + 0.35))); z += 0.7; }
    }
    if (Math.abs(i - mid) < 0.01) hang = z;
  }
  if (hang === undefined) { hang = barZ(0) + 0.5; g.add(jumpRing(m, 0.6, 0.16, v3(0, -0.3, hang))); }
  return { g, hang };
}

/** an open gold outline, plain or pavé, with an optional stone inside */
function dropFramePart(d: Design, m: Mats, p: DropPart): Built {
  const g = new THREE.Group();
  const cs = partStone(d, p);
  const r = p.halo ? p.haloMm / 2 + 0.35 : 0.55;
  const curve = outlineCurve(cs, p.showStone ? p.spreadMm + r : 0, 0);
  const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 200, r, 12, true), m.metal);
  wire.scale.y = 0.7;
  g.add(wire);
  if (p.halo) g.add(patternRun(paveDesign(d, p), m, curve, 0, 1, { closed: true, gap: 0.14, maxW: p.haloMm, offset: () => v3(0, r * 0.55, 0) }).group);
  if (p.showStone) {
    g.add(setStoneRaw(cs, setFor(d, cs), m));
    // four little bars hold the stone in the frame
    const fn = outlineFn(cs.shape, cs.lengthMm, cs.widthMm);
    for (const u of [0, 0.25, 0.5, 0.75]) { const [x, z] = fn(u); const len = Math.hypot(x, z) || 1; g.add(tube(m, [v3(x, -0.4, z), v3(x * (1 + (p.spreadMm + r) / len), -0.4, z * (1 + (p.spreadMm + r) / len))], 0.22)); }
  }
  g.rotation.y = THREE.MathUtils.degToRad(p.stone.rotation);
  return { g };
}

/** a ribbon bow set with small stones; the knot can hold a stone */
function dropBowPart(d: Design, m: Mats, p: DropPart): Built {
  const g = new THREE.Group();
  const w = Math.max(8, p.spreadMm), h = w * 0.55;
  const r = p.haloMm / 2 + 0.4;
  const pd = paveDesign(d, p);
  const curves: { c: THREE.Curve<THREE.Vector3>; closed: boolean }[] = [];
  for (const s of [-1, 1]) {
    const loop = [[0.03, 0], [0.18, -0.42], [0.4, -0.5], [0.5, -0.12], [0.42, 0.28], [0.18, 0.16]].map(([x, z]) => v3(s * x * w, 0, z * h));
    curves.push({ c: new THREE.CatmullRomCurve3(loop, true, "centripetal"), closed: true });
    const tail = [[0.04, 0.12], [0.12, 0.55], [0.2, 1.0], [0.26, 1.3]].map(([x, z]) => v3(s * x * w, -0.2, z * h));
    curves.push({ c: new THREE.CatmullRomCurve3(tail, false, "centripetal"), closed: false });
  }
  for (const { c, closed } of curves) {
    const t = new THREE.Mesh(new THREE.TubeGeometry(c, 160, r, 10, closed), m.metal);
    t.scale.y = 0.6;
    g.add(t);
    if (p.halo) g.add(patternRun(pd, m, c, 0, 1, { closed, gap: 0.14, maxW: p.haloMm, offset: () => v3(0, r * 0.5, 0) }).group);
    if (!closed) { const cap = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), m.metal); cap.scale.y = 0.6; cap.position.copy(c.getPointAt(1)); g.add(cap); }
  }
  const cs = partStone(d, p);
  let top = -1.2;
  if (p.showStone) {
    const knot = setStoneRaw(cs, setFor(d, cs), m);
    knot.rotation.y = THREE.MathUtils.degToRad(p.stone.rotation);
    knot.position.y = 0.35;
    g.add(knot, backingPlate(m, outlineFn(cs.shape, cs.lengthMm, cs.widthMm), 1.15, -0.3, 0.6));
    top = -cs.lengthMm / 2 - 0.3;
  } else {
    const k = new THREE.Mesh(new THREE.SphereGeometry(1.4, 18, 12), m.metal); k.scale.set(1, 0.7, 1.3); g.add(k);
  }
  return { g, top, hang: h * 0.2 };
}

/** stack every part from the top down; the first part's top is at z = 0 */
function dropStack(d: Design, m: Mats) {
  const group = new THREE.Group();
  // where each part landed: its x, its top and hanging point (z), and half its width
  const placed: { x: number; top: number; hang: number; half: number }[] = [];
  const link = (p: DropPart, ax: number, az: number, bx: number, bz: number) => {
    const A = v3(ax, -0.3, az), B = v3(bx, -0.3, bz), len = A.distanceTo(B);
    if (p.link === "ring" && len < 3 && Math.abs(ax - bx) < 0.5) group.add(jumpRing(m, Math.max(0.7, len / 2 + 0.55), 0.2, A.clone().lerp(B, 0.5)));
    else if (p.link === "direct") group.add(tube(m, [A.clone().setY(-0.7).add(v3(0, 0, -0.6)), B.clone().setY(-0.7).add(v3(0, 0, 0.6))], 0.35));
    else {
      // longer or slanted joins: a jump ring at each end and fine chain between
      group.add(jumpRing(m, 0.6, 0.17, A), jumpRing(m, 0.6, 0.17, B));
      if (len > 1.2) group.add(chainAlong(new THREE.LineCurve3(A, B), "fine", m));
    }
  };
  d.drop.parts.forEach((p, i) => {
    const build = () => {
      const b = p.kind === "strands" ? dropStrandsPart(d, m, p) : p.kind === "frame" ? dropFramePart(d, m, p) : p.kind === "bow" ? dropBowPart(d, m, p) : dropStonePart(d, m, p);
      b.g.userData.part = "drop";
      b.g.userData.dropIndex = i;
      return b;
    };
    const b = build();
    const box = new THREE.Box3().setFromObject(b.g);
    const top = b.top ?? box.min.z, hang = b.hang ?? box.max.z, half = (box.max.x - box.min.x) / 2;
    const parentIdx = i === 0 ? -1 : p.from >= 0 && p.from < i ? p.from : i - 1;
    const par = parentIdx >= 0 ? placed[parentIdx] : null;
    const tilt = THREE.MathUtils.degToRad(p.tilt);
    // place one copy: dir = 1 for the part, -1 for its mirrored twin
    const put = (g: THREE.Group, dir: 1 | -1) => {
      let x = 0, z0 = 0;
      if (par && p.anchor === "beside") {
        const s = (p.side === "right" ? 1 : -1) * dir;
        x = par.x + s * (par.half + p.gapMm + half) + p.offsetX * dir;
        z0 = par.top + p.offsetZ;
        // a hidden bar joins neighbours behind the stones
        group.add(tube(m, [v3(par.x, -0.9, z0 + (hang - top) / 2), v3(x, -0.9, z0 + (hang - top) / 2)], 0.35));
      } else if (par) {
        x = par.x + p.offsetX * dir;
        z0 = par.hang + p.gapMm + p.offsetZ;
        link(p, par.x, par.hang, x, z0);
      } else { x = p.offsetX; z0 = p.offsetZ; }
      // tilt about the part's own top, where it hangs from
      const pivot = new THREE.Group();
      pivot.position.set(x, 0, z0);
      pivot.rotation.y = -tilt * dir;
      g.position.z = -top;
      if (dir === -1) pivot.scale.x = -1;
      pivot.add(g);
      group.add(pivot);
      return { x, top: z0, hang: z0 + (hang - top) * Math.cos(tilt), half };
    };
    placed[i] = put(b.g, 1);
    if (p.pair && i > 0) put(build().g, -1);
  });
  const all = new THREE.Box3().setFromObject(group);
  return { group, top: placed[0]?.top ?? 0, bottom: all.isEmpty() ? 0 : all.max.z };
}

/** a french hook above an earring's top */
function hook(m: Mats, top: number) {
  const pts = [v3(0, -0.2, top + 0.6), v3(0, -0.2, top - 4), v3(-1.2, -0.2, top - 9), v3(-4.5, -0.2, top - 11), v3(-7.5, -0.2, top - 9), v3(-8.4, -0.2, top - 4), v3(-8.2, -0.2, top + 1)];
  const g = new THREE.Group();
  g.add(tube(m, pts, 0.38));
  const bead = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), m.metal); bead.position.copy(pts[1]); g.add(bead);
  return g;
}

function earringPiece(d: Design, m: Mats): Piece {
  const rd = d.rightEar ? rightEarDesign(d) : null;
  if (d.style === "hoop" || d.style === "huggie") return hoopPair(d, m, d.style === "huggie", rd);
  const L = earringOne(d, m, false);
  const studMirror = d.style === "stud" && d.mirrorPair && !rd;
  const R = rd ? earringOne(rd, m, false) : studMirror ? earringOne(d, m, true) : { one: L.one.clone(), focus: L.focus, focusSize: L.focusSize };
  const wOf = (g: THREE.Object3D) => { const b = new THREE.Box3().setFromObject(g); return { w: b.max.x - b.min.x, c: (b.max.x + b.min.x) / 2 }; };
  const a = wOf(L.one), b = wOf(R.one);
  const sep = (a.w + b.w) / 2 + 10;
  L.one.position.x = -sep / 2 - a.c; R.one.position.x = sep / 2 - b.c;
  if (!rd && (d.style === "climber" || ((d.style === "chandelier" || d.style === "pendant") && d.mirrorPair))) { R.one.scale.x = -1; R.one.position.x = sep / 2 + b.c; }
  if (rd && rd.style === "climber") { R.one.scale.x = -1; R.one.position.x = sep / 2 + b.c; }
  L.one.userData.ear = "left"; R.one.userData.ear = "right";
  const group = new THREE.Group();
  group.add(L.one, R.one);
  const focus = L.focus.clone(); focus.x += L.one.position.x;
  return { group, focus, focusSize: Math.max(L.focusSize, rd ? R.focusSize : 0), upright: false };
}

/** one earring, centred where it was built (the pair is laid out by earringPiece) */
function earringOne(d: Design, m: Mats, mirrorStud: boolean): { one: THREE.Group; focus: THREE.Vector3; focusSize: number } {
  const c = d.center, o = d.options, st = d.style;
  const one = new THREE.Group();
  let focus = v3(), focusSize = Math.max(c.lengthMm, c.widthMm) * 1.6;
  const accentDia = roundDiameter(d.accents.gem, d.accents.sizeCt);
  const topStud = (z = 0) => {
    const f = flower(d, m, { ...c, lengthMm: Math.min(c.lengthMm, 6), widthMm: Math.min(c.widthMm, 6) });
    f.group.position.z = z;
    one.add(f.group);
    return f.radius;
  };

  if (st === "stud") {
    one.add(stud(d, m, mirrorStud));
    focusSize = Math.max(c.lengthMm, c.widthMm) * (1.6 + d.extraStones.length);
  } else if (st === "drop") {
    let top: number;
    if (o.accentTop) { one.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: v3(), dia: accentDia }])); top = accentDia / 2; }
    else { one.add(new THREE.Mesh(new THREE.SphereGeometry(1.4, 24, 16), m.metal)); top = 1.4; }
    one.add(jumpRing(m, 0.9, 0.22, v3(0, -0.2, top + 0.6)));
    const drop = setStone(c, d.setting.style, m);
    if (c.shape === "pear") drop.rotation.y = Math.PI;
    const z = top + 1.5 + c.lengthMm / 2 + 0.4;
    drop.position.set(0, 0, z);
    one.add(drop);
    focus = v3(0, 0, z);
  } else if (st === "chandelier" || st === "pendant") {
    const stack = dropStack(d, m);
    one.add(stack.group);
    if (d.drop.top === "hook") one.add(hook(m, stack.top - 0.5));
    focus = v3(0, 0, stack.bottom * 0.5); focusSize = Math.max(18, stack.bottom * 1.25);
  } else if (st === "jhumka") {
    const r = topStud();
    const b = bell(d, m, Math.max(7, r * 1.15));
    const z0 = r + 2.2;
    b.group.position.z = z0;
    one.add(b.group, jumpRing(m, 1, 0.28, v3(0, 0, r + 0.9)));
    const n = Math.floor((Math.PI * 2 * b.R) / (d.fringe.sizeMm + 0.5));
    one.add(fringe(d, m, Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2;
      return { pos: v3(Math.cos(a) * b.R, Math.sin(a) * b.R * 0.35, z0 + b.rimZ), dir: v3(0, 0, 1) };
    })));
    focus = v3(0, 0, z0); focusSize = (z0 + b.rimZ) * 1.8;
  } else if (st === "chandbali") {
    const r = topStud();
    const R = Math.max(14, r * 2.3), zc = r + 2 + R * 0.25;
    const outerPts: THREE.Vector2[] = [], innerPts: THREE.Vector2[] = [];
    for (let i = 0; i <= 48; i++) {
      const a = (i / 48) * Math.PI;
      outerPts.push(new THREE.Vector2(Math.cos(a) * R, Math.sin(a) * R));
      innerPts.push(new THREE.Vector2(Math.cos(Math.PI - a) * R * 0.66, Math.sin(Math.PI - a) * R * 0.66 - R * 0.12));
    }
    const shape = new THREE.Shape([...outerPts, ...innerPts]);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.3, bevelEnabled: true, bevelThickness: 0.25, bevelSize: 0.25, bevelSegments: 2, curveSegments: 6 });
    geo.rotateX(Math.PI / 2); geo.translate(0, -0.3, zc);
    one.add(new THREE.Mesh(geo, m.metal));
    if (d.enamel.enabled) { const e = new THREE.Mesh(geo.clone().translate(0, -0.6, 0).scale(1.02, 1, 1), m.enamel); one.add(e); }
    // two arcs of stones following the crescent
    for (const k of [0.92, 0.76]) {
      const rr = R * k - (k < 0.8 ? R * 0.05 : 0);
      const arcC = new THREE.CatmullRomCurve3(Array.from({ length: 48 }, (_, i) => { const a = 0.12 + (i / 47) * (Math.PI - 0.24); return v3(Math.cos(a) * rr, 0.4, zc + Math.sin(a) * rr); }));
      one.add(patternRun(d, m, arcC, 0, 1, { maxW: R * 0.12, gap: 0.25 }).group);
    }
    // centre stone sits in the crescent's hollow
    const cs = setStone(c, d.setting.style, m, Math.min(1, (R * 0.5) / Math.max(c.lengthMm, c.widthMm)));
    if (c.shape === "pear") cs.rotation.y = Math.PI;
    cs.position.set(0, 0.2, zc + R * 0.18);
    one.add(cs, tube(m, [v3(0, 0.1, zc - R * 0.08), v3(0, 0.1, zc + R * 0.02)], 0.25));
    one.add(tube(m, [v3(-R, 0, zc), v3(-R * 0.5, 0, r + 1.2), v3(0, 0, r + 0.6), v3(R * 0.5, 0, r + 1.2), v3(R, 0, zc)], 0.3));
    const nf = Math.floor((Math.PI * R) / (d.fringe.sizeMm + 0.6));
    one.add(fringe(d, m, Array.from({ length: nf }, (_, i) => {
      const a = (i / Math.max(1, nf - 1)) * Math.PI;
      return { pos: v3(Math.cos(a) * (R + 0.3), 0, zc + Math.sin(a) * (R + 0.3)), dir: v3(Math.cos(a), 0, Math.sin(a)) };
    })));
    focus = v3(0, 0, zc + R * 0.4); focusSize = R * 2.8;
  } else if (st === "climber") {
    const n = Math.max(3, o.count);
    const curveC = new THREE.CatmullRomCurve3(Array.from({ length: 24 }, (_, i) => { const t = i / 23; return v3(Math.sin(t * 1.3) * 10, 0, -t * 22); }));
    // graduated widths; elongated shapes take up their length along the climb, so space by real footprint
    const orient = d.accents.orientation;
    const spec = Array.from({ length: n }, (_, i) => {
      const shape = d.accents.shapes[i % d.accents.shapes.length];
      const along = orient === "along" || (orient === "alternate" && i % 2 === 0);
      const W = accentDia * (1.4 - 0.8 * (i / (n - 1)));
      const t = THREE.MathUtils.degToRad(d.accents.turns[i % d.accents.shapes.length] ?? 0);
      const a = along ? W * ASPECT[shape] : W, b = along ? W : W * ASPECT[shape];
      return { W, foot: Math.abs(Math.cos(t)) * a + Math.abs(Math.sin(t)) * b };
    });
    const len = curveC.getLength(), need = spec.reduce((a, x) => a + x.foot + 0.25, 0);
    const k = Math.min(1, len / need);
    let at = 0;
    const items = spec.map((x) => {
      const u = Math.min(1, (at + (x.foot * k) / 2) / len);
      at += x.foot * k + 0.25 * k;
      return { pos: curveC.getPointAt(u), dia: x.W * k, tan: curveC.getTangentAt(u) };
    });
    one.add(patternAt(d, m, items));
    one.add(tube(m, items.map((it) => it.pos.clone().setY(-0.5)), 0.35));
    focus = v3(4, 0, -11); focusSize = 30;
  } else {
    // tassel
    one.add(setStone(c, d.setting.style, m, Math.min(1, 6 / Math.max(c.lengthMm, c.widthMm))));
    const capZ = Math.min(c.lengthMm, 6) / 2 + 2.5;
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.6, 4, 32, 1, true), m.metal);
    cap.rotation.x = -Math.PI / 2; cap.position.z = capZ + 2;
    one.add(cap);
    const strands = Math.max(3, o.count);
    for (let s = 0; s < strands; s++) {
      const x = (s / (strands - 1) - 0.5) * 4.2;
      const pts = Array.from({ length: 9 }, (_, i) => v3(x * (1 + i * 0.08), 0, capZ + 4 + i * (d.fringe.sizeMm * 0.8)));
      one.add(balls(d.fringe.enabled ? m.bead(d.fringe.gem, d.fringe.color) : m.metal, pts.map((p) => ({ pos: p, dia: Math.min(2.4, d.fringe.sizeMm * 0.55) }))));
    }
    focus = v3(0, 0, capZ + 12); focusSize = 50;
  }

  return { one, focus, focusSize };
}

function necklacePiece(d: Design, m: Mats): Piece {
  const c = d.center, o = d.options, st = d.style;
  const group = new THREE.Group();
  const L = o.lengthIn * 25.4;
  const pointy = st === "pendant" || st === "lariat" || st === "rani-haar" || st === "mangalsutra" ? 0.22 : 0.08;
  const { curve, front } = loopCurve(L, 0.85, pointy);
  const fp = curve.getPointAt(front);
  let focus = fp.clone(), focusSize = Math.max(c.lengthMm, c.widthMm) * 2.5;
  const accentDia = roundDiameter(d.accents.gem, d.accents.sizeCt);
  const hang = (obj: THREE.Object3D, at: THREE.Vector3, len: number) => { obj.position.copy(at).add(v3(0, 0, len)); group.add(obj); return obj.position.clone(); };

  switch (st) {
    case "pendant": {
      group.add(chainAlong(curve, o.chain, m));
      const bail = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.5, 12, 32, Math.PI * 1.2), m.metal);
      bail.position.copy(fp).add(v3(0, 0, 0.6)); bail.rotation.set(Math.PI / 2, 0, -Math.PI * 0.1);
      group.add(bail);
      const pend = new THREE.Group();
      pend.add(setStone(c, d.setting.style, m));
      let extra = 0;
      if (o.halo) { const h = halo(d, m, c); pend.add(h.group); extra = h.extent; }
      if (c.shape === "pear") pend.rotation.y = Math.PI;
      focus = hang(pend, fp, 2.4 + c.lengthMm / 2 + extra);
      break;
    }
    case "drop-pendant": {
      group.add(chainAlong(curve, o.chain, m));
      const bail = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.5, 12, 32, Math.PI * 1.2), m.metal);
      bail.position.copy(fp).add(v3(0, 0, 0.6)); bail.rotation.set(Math.PI / 2, 0, -Math.PI * 0.1);
      group.add(bail);
      const stack = dropStack(d, m);
      stack.group.position.copy(fp).add(v3(0, 0, 2.4 - stack.top));
      group.add(stack.group);
      focus = fp.clone().add(v3(0, 0, 2.4 + (stack.bottom - stack.top) / 2));
      focusSize = Math.max(24, (stack.bottom - stack.top) * 1.4);
      break;
    }
    case "riviera": {
      const total = curve.getLength(), count = o.count;
      const sizes = Array.from({ length: count }, (_, i) => { const k = Math.abs(i - (count - 1) / 2) / ((count - 1) / 2 || 1); return 1 - 0.55 * Math.pow(k, 1.3); });
      const span = sizes.reduce((a, s) => a + (c.widthMm * s + 0.35), 0);
      let u = front - span / 2 / total;
      for (let i = 0; i < count; i++) {
        const w = c.widthMm * sizes[i] + 0.35, at = wrap(u + w / 2 / total);
        group.add(place(setStone(c, d.setting.style === "bezel" ? "bezel" : "four-claw", m, sizes[i]), curve.getPointAt(at), yawAt(curve, at)));
        u += w / total;
      }
      group.add(chainAlong(curve, "box", m, front + span / 2 / total, front + 1 - span / 2 / total));
      focusSize = c.widthMm * 4;
      break;
    }
    case "station": {
      group.add(chainAlong(curve, o.chain, m));
      for (const u of spreadParams(front, o.count, 0.62)) group.add(place(setStone(c, d.setting.style, m), curve.getPointAt(u).add(v3(0, 0.2, 0)), yawAt(curve, u)));
      break;
    }
    case "lariat": {
      group.add(chainAlong(curve, o.chain, m));
      const dropLen = 70;
      const drop = new THREE.LineCurve3(fp.clone(), fp.clone().add(v3(0, 0, dropLen)));
      group.add(chainAlong(drop, o.chain, m));
      group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: fp.clone().add(v3(0, 0.3, 0)), dia: Math.max(accentDia, 3) }]));
      const s = setStone(c, d.setting.style, m);
      if (c.shape === "pear") s.rotation.y = Math.PI;
      focus = hang(s, fp, dropLen + c.lengthMm / 2 + 1);
      focusSize = 60;
      break;
    }
    case "choker": {
      const rows = Math.max(1, o.layers);
      const spread = 0.5, n = Math.floor((curve.getLength() * spread) / (accentDia + 0.25));
      let bottom: { pos: THREE.Vector3; dir: THREE.Vector3 }[] = [];
      for (let r = 0; r < rows; r++) {
        group.add(patternRun(d, m, curve, front - spread / 2, front + spread / 2, { offset: (u) => outwardAt(curve, u).multiplyScalar(r * (accentDia + 0.3)), gap: 0.25 }).group);
        if (r === rows - 1) bottom = spreadParams(front, n, spread).filter((_, i) => i % 2 === 0).map((u) => ({ pos: curve.getPointAt(u).addScaledVector(outwardAt(curve, u), r * (accentDia + 0.3) + accentDia / 2), dir: outwardAt(curve, u) }));
      }
      group.add(chainAlong(curve, "box", m, front + spread / 2, front + 1 - spread / 2));
      group.add(fringe(d, m, bottom));
      focusSize = 40;
      break;
    }
    case "collar": {
      group.add(chainAlong(curve, "box", m));
      const params = spreadParams(front, o.count, 0.4);
      params.forEach((u, i) => {
        const k = 1 - Math.abs(i - (params.length - 1) / 2) / ((params.length - 1) / 2 || 1);
        const s = setStone({ ...c, shape: c.shape === "round" ? "pear" : c.shape }, d.setting.style, m, 0.45 + 0.55 * k);
        const out = outwardAt(curve, u);
        s.position.copy(curve.getPointAt(u)).addScaledVector(out, 2 + (c.lengthMm * (0.45 + 0.55 * k)) / 2 + k * 6);
        s.quaternion.setFromUnitVectors(v3(0, 0, -1), out.clone().negate());
        if (c.shape === "pear") s.rotateY(Math.PI);
        group.add(s);
        group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: curve.getPointAt(u).addScaledVector(out, 1), dia: accentDia }]));
        group.add(tube(m, [curve.getPointAt(u).addScaledVector(out, 1.5), curve.getPointAt(u).addScaledVector(out, 1.5 + k * 6)], 0.2));
      });
      focusSize = 60;
      break;
    }
    case "kundan-choker": {
      const f0 = flower(d, m, c);
      const step = f0.radius * 2 + 0.6;
      const total = curve.getLength();
      const n = Math.max(1, o.count);
      const span = (n * step) / total;
      const params = spreadParams(front, n, span - step / total);
      const anchors: { pos: THREE.Vector3; dir: THREE.Vector3 }[] = [];
      params.forEach((u, i) => {
        const f = i === 0 ? f0 : flower(d, m, c);
        group.add(place(f.group, curve.getPointAt(u), yawAt(curve, u)));
        const out = outwardAt(curve, u);
        for (const k of [-0.5, 0, 0.5]) {
          const t = curve.getTangentAt(u);
          anchors.push({ pos: curve.getPointAt(u).addScaledVector(out, f.radius).addScaledVector(t, k * f.radius), dir: out });
        }
      });
      group.add(fringe(d, m, anchors, 2));
      group.add(beadStrand(m, curve, "pearl", "#f3ede2", 2.2, 0, front + span / 2, front + 1 - span / 2));
      focusSize = f0.radius * 7;
      break;
    }
    case "rani-haar": {
      const layers = Math.max(1, o.layers);
      for (let i = 0; i < layers; i++) {
        const { curve: cv, front: fr } = layeredLoop(L, i * 64, 0.85, 0.22);
        if (d.fringe.enabled && i % 2 === 0) group.add(beadStrand(m, cv, d.fringe.gem, d.fringe.color, Math.max(2.5, d.fringe.sizeMm * 0.7), 9, fr + 0.03, fr + 0.97));
        else group.add(chainAlong(cv, "rope", m, fr + 0.03, fr + 0.97));
      }
      const { curve: longest, front: lf } = layeredLoop(L, (layers - 1) * 64, 0.85, 0.22);
      const lp = longest.getPointAt(lf);
      const f = flower(d, m, c);
      focus = hang(f.group, lp, f.radius - 2);
      group.add(fringe(d, m, Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.2 + 0.6 * (i / 6)); return { pos: focus.clone().add(v3(Math.cos(a) * f.radius, 0, Math.sin(a) * f.radius)), dir: v3(Math.cos(a), 0, Math.sin(a)) }; }), 2));
      // side ornaments (where strands gather)
      for (const s of [-1, 1]) {
        const sp = curve.getPointAt(wrap(lf + s * 0.32));
        group.add(place(coin(m, 4), sp.clone().add(v3(0, 0.3, 0))));
      }
      focusSize = f.radius * 6;
      break;
    }
    case "temple": {
      group.add(chainAlong(curve, "rope", m));
      const r = 4.2;
      for (const u of spreadParams(front, o.count, 0.5)) {
        if (Math.abs(u - front) < 0.005) continue;
        const cg = coin(m, r);
        cg.position.copy(curve.getPointAt(u)).addScaledVector(outwardAt(curve, u), r + 0.5);
        group.add(cg);
      }
      const big = coin(m, 11);
      const s = setStone(c, "bezel", m, Math.min(1, 9 / Math.max(c.lengthMm, c.widthMm)));
      s.position.y = 0.4;
      big.add(s);
      focus = hang(big, fp, 12.5);
      group.add(fringe(d, m, Array.from({ length: 9 }, (_, i) => { const a = Math.PI * (0.1 + 0.8 * (i / 8)); return { pos: focus.clone().add(v3(Math.cos(a) * 11, 0, Math.sin(a) * 11)), dir: v3(Math.cos(a), 0, Math.sin(a)) }; })));
      focusSize = 60;
      break;
    }
    case "mangalsutra": {
      const layers = Math.max(1, o.layers);
      for (let i = 0; i < layers; i++) {
        const { curve: cv, front: fr } = layeredLoop(L, i * 10, 0.85, 0.22);
        group.add(beadStrand(m, cv, "onyx", "#101012", 2.2, 10, fr + 0.01, fr + 0.99));
      }
      const pend = setStone(c, "bezel", m, Math.min(1, 12 / Math.max(c.lengthMm, c.widthMm)));
      if (c.shape === "pear") pend.rotation.y = Math.PI;
      focus = hang(pend, fp, 3 + (c.lengthMm * Math.min(1, 12 / Math.max(c.lengthMm, c.widthMm))) / 2);
      group.add(jumpRing(m, 1, 0.3, fp.clone().add(v3(0, 0, 1.2))));
      break;
    }
    default: {
      // pearl strand(s)
      const layers = Math.max(1, o.layers);
      for (let i = 0; i < layers; i++) {
        const { curve: cv, front: fr } = layeredLoop(L, i * 38, 0.85, 0.08);
        group.add(beadStrand(m, cv, d.fringe.gem, d.fringe.color, d.fringe.sizeMm, 0, fr + 0.505, fr + 1.495));
        if (i === 0) {
          const clasp = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 4), m.metal);
          clasp.position.copy(cv.getPointAt(wrap(fr + 0.5)));
          group.add(clasp);
        }
      }
      focusSize = d.fringe.sizeMm * 10;
    }
  }
  return { group, focus, focusSize, upright: false };
}

function braceletPiece(d: Design, m: Mats, circumference?: number): Piece {
  const c = d.center, o = d.options, st = d.style;
  const group = new THREE.Group();
  const solid = st === "bangle" || st === "kada" || st === "cuff";
  const circ = circumference ?? (solid ? Math.PI * bangleDiameter(o.bangleSize) : o.wristCm * 10 + 15);
  const { curve, front } = loopCurve(circ, 1.12, 0);
  const fp = curve.getPointAt(front);
  let focus = fp.clone(), focusSize = 24;
  const accentDia = roundDiameter(d.accents.gem, d.accents.sizeCt);
  const outFront = outwardAt(curve, front);

  if (st === "tennis") {
    const run = patternRun(d, m, curve, front, front + 1, { closed: true, gap: 0.45 });
    group.add(run.group);
    const under = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, Math.max(0.45, run.maxW * 0.08), 8, true), m.metal);
    under.position.y = -run.maxW * 0.45;
    group.add(under);
    focusSize = run.maxW * 7;
  } else if (solid) {
    const thick = st === "kada" ? 3.4 : st === "cuff" ? 1.6 : 1.8;
    const height = st === "cuff" ? 7 : st === "kada" ? 1.3 : 1;
    const cuffCurve = st === "cuff" ? new THREE.CatmullRomCurve3(Array.from({ length: 80 }, (_, i) => curve.getPointAt(wrap(front - 0.42 + (i / 79) * 0.84)))) : curve;
    const band = new THREE.Mesh(new THREE.TubeGeometry(cuffCurve, 400, thick, 24, st !== "cuff"), m.metal);
    band.scale.y = height;
    group.add(band);
    const faceOut = (u: number, extra = 0) => curve.getPointAt(u).addScaledVector(outwardAt(curve, u), thick + extra);
    if (st === "kada") {
      const params = spreadParams(front, Math.floor((curve.getLength() * 0.55) / (accentDia + 0.6)), 0.55);
      group.add(patternRun(d, m, curve, front - 0.275, front + 0.275, { offset: () => v3(0, thick * height * 0.92, 0), maxW: thick * 1.6, gap: 0.6 }).group);
      if (d.enamel.enabled) group.add(balls(m.enamel, params.map((u) => ({ pos: faceOut(u, -0.4), dia: thick * 0.9 })), 1.2));
      group.add(balls(m.metal, Array.from({ length: 160 }, (_, i) => { const u = i / 160; return { pos: curve.getPointAt(u).add(v3(0, thick * height * 0.55, 0)).addScaledVector(outwardAt(curve, u), thick * 0.75), dia: 0.7 }; })));
    }
    if (st === "cuff") {
      const rows = Math.max(1, o.layers);
      for (let r = 0; r < rows; r++) {
        const lift = (r - (rows - 1) / 2) * (accentDia + 1.2) * 1.6;
        for (const [a, b] of [[front - 0.3, front - 0.04], [front + 0.04, front + 0.3]])
          group.add(patternRun(d, m, curve, a, b, { up: (u) => outwardAt(curve, u), offset: (u) => outwardAt(curve, u).multiplyScalar(thick).add(v3(0, lift, 0)), gap: 0.3 }).group);
      }
    }
    if (st !== "kada") {
      const s = setStone(c, d.setting.style, m, Math.min(1, (st === "bangle" ? 12 : 16) / Math.max(c.lengthMm, c.widthMm)));
      s.position.copy(faceOut(front, 0.2));
      s.quaternion.setFromUnitVectors(Y, outFront);
      group.add(s);
      focus = s.position.clone();
      focusSize = 30;
    } else focusSize = 40;
  } else if (st === "beaded") {
    const rows = Math.max(1, o.layers);
    for (let r = 0; r < rows; r++) {
      const { curve: cv, front: fr } = loopCurve(circ + r * 8, 1.12, 0);
      group.add(beadStrand(m, cv, d.fringe.gem, d.fringe.color, d.fringe.sizeMm, 0, fr + 0.04, fr + 0.96));
    }
    const s = setStone(c, "bezel", m, Math.min(1, 10 / Math.max(c.lengthMm, c.widthMm)));
    s.position.copy(fp);
    group.add(s);
    focus = fp.clone();
  } else if (st === "charm") {
    group.add(chainAlong(curve, o.chain, m));
    for (const u of Array.from({ length: o.count }, (_, i) => wrap(front + (i - (o.count - 1) / 2) / o.count))) {
      const out = outwardAt(curve, u);
      const s = setStone(c, "bezel", m, Math.min(1, 6 / Math.max(c.lengthMm, c.widthMm)));
      s.position.copy(curve.getPointAt(u)).addScaledVector(out, 5);
      group.add(s, place(new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.25, 8, 20), m.metal), curve.getPointAt(u).addScaledVector(out, 1.4), yawAt(curve, u)));
    }
    focusSize = 40;
  } else {
    // station bracelet / anklet
    group.add(chainAlong(curve, o.chain, m));
    for (let i = 0; i < o.count; i++) {
      const u = wrap(front + i / o.count);
      group.add(place(setStone(c, d.setting.style, m), curve.getPointAt(u).add(v3(0, 0.2, 0)), yawAt(curve, u)));
    }
  }
  return { group, focus, focusSize, upright: false };
}

function ankletPiece(d: Design, m: Mats): Piece {
  if (d.style === "station-anklet") return braceletPiece({ ...d, style: "station" }, m, 245);
  const group = new THREE.Group();
  const { curve, front } = loopCurve(250, 1.12, 0);
  group.add(chainAlong(curve, d.options.chain, m));
  const n = Math.max(4, d.options.count);
  const bells: Item[] = [], loops: Item[] = [], dots: Item[] = [];
  for (let i = 0; i < n; i++) {
    const u = wrap(front + (i - (n - 1) / 2) * (0.75 / n));
    const out = outwardAt(curve, u), p = curve.getPointAt(u);
    loops.push({ pos: p.clone().addScaledVector(out, 1.2), dia: 1 });
    bells.push({ pos: p.clone().addScaledVector(out, 3.6), dia: 4.2 });
    if (i % 3 === 1) dots.push({ pos: p.clone().add(v3(0, 0.8, 0)), dia: 2.2 });
  }
  group.add(balls(m.metal, bells), balls(m.metal, loops));
  if (d.enamel.enabled) group.add(balls(m.enamel, dots, 0.6));
  else group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, dots.map((x) => ({ ...x, dia: roundDiameter(d.accents.gem, d.accents.sizeCt) }))));
  return { group, focus: curve.getPointAt(front), focusSize: 40, upright: false };
}

function headpiecePiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const c = d.center;
  const f = flower(d, m, c);
  group.add(f.group);
  // the chain runs up the parting (−Z) to a hook
  const top = v3(0, 0, -f.radius - 70);
  group.add(chainAlong(new THREE.LineCurve3(v3(0, 0, -f.radius - 0.5), top), "fine", m));
  const hook = new THREE.Mesh(new THREE.TorusGeometry(3, 0.5, 10, 32, Math.PI * 1.5), m.metal);
  hook.rotation.x = Math.PI / 2; hook.position.copy(top).add(v3(0, 0, -3));
  group.add(hook);
  group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: v3(0, 0.3, -f.radius - 4), dia: Math.max(2.5, roundDiameter(d.accents.gem, d.accents.sizeCt)) }]));
  group.add(fringe(d, m, Array.from({ length: 7 }, (_, i) => { const a = Math.PI * (0.15 + 0.7 * (i / 6)); return { pos: v3(Math.cos(a) * f.radius, 0, Math.sin(a) * f.radius), dir: v3(Math.cos(a), 0, Math.sin(a)) }; }), 2));
  if (d.style === "matha-patti") {
    for (const s of [-1, 1]) {
      for (let row = 0; row < 2; row++) {
        const pts = Array.from({ length: 24 }, (_, i) => { const t = i / 23; return v3(s * (t * 95 + 2), 0, top.z + 6 + row * 9 + Math.sin(t * Math.PI) * (26 + row * 8) - t * 8); });
        const cv = new THREE.CatmullRomCurve3(pts);
        group.add(chainAlong(cv, "fine", m));
        const n = Math.max(2, d.options.count);
        const items: Item[] = Array.from({ length: n }, (_, i) => ({ pos: cv.getPointAt((i + 0.5) / n).add(v3(0, 0.3, 0)), dia: Math.max(2.4, roundDiameter(d.accents.gem, d.accents.sizeCt) * 1.4) }));
        group.add(patternAt(d, m, items.map((it, i) => ({ ...it, tan: cv.getTangentAt((i + 0.5) / n) }))));
        if (row === 1) group.add(fringe(d, m, items.map((it) => ({ pos: it.pos.clone().add(v3(0, 0, it.dia / 2)), dir: v3(0, 0, 1) }))));
      }
    }
  }
  return { group, focus: v3(), focusSize: f.radius * 4, upright: false };
}

function nosePiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  if (d.style === "nose-stud") {
    group.add(setStone(d.center, d.setting.style, m));
    if (d.options.halo) group.add(halo(d, m, d.center).group);
    return { group, focus: v3(), focusSize: Math.max(8, d.center.lengthMm * 3), upright: false };
  }
  const R = d.options.hoopDiameterMm / 2;
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(R, 0.55, 12, 160), m.metal);
  hoop.rotation.x = Math.PI / 2;
  group.add(hoop);
  // pearls and stones along the lower front of the hoop
  const beads: Item[] = [], stones: Item[] = [];
  const pd = d.fringe.sizeMm, sd = Math.max(1.6, roundDiameter(d.accents.gem, d.accents.sizeCt));
  for (let a = Math.PI * 0.22, i = 0; a < Math.PI * 0.78; i++) {
    const isPearl = i % 2 === 0, dia = isPearl ? pd : sd;
    beads.length; (isPearl ? beads : stones).push({ pos: v3(Math.cos(a) * R, 0, Math.sin(a) * R), dia, up: Y });
    a += (dia + 0.3) / R;
  }
  group.add(balls(m.bead(d.fringe.gem, d.fringe.color), beads));
  group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, stones.map((s) => ({ ...s, pos: s.pos.clone().add(v3(0, 0.6, 0)) }))));
  // a bead drop at the base and the chain sweeping up to the ear
  group.add(fringe({ ...d, fringe: { ...d.fringe, enabled: true } }, m, [{ pos: v3(0, 0, R + pd / 2), dir: v3(0, 0, 1) }], 2));
  const chain = new THREE.CatmullRomCurve3([v3(R * 0.7, 0, -R * 0.7), v3(R * 2, 0, -R * 1.4), v3(R * 3.4, 0, -R * 0.6), v3(R * 4.2, 0, -R * 1.8)]);
  group.add(chainAlong(chain, "fine", m));
  return { group, focus: v3(0, 0, R * 0.6), focusSize: R * 3, upright: false };
}

function armletPiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const { curve, front } = loopCurve(280, 1.0, 0);
  const arc = new THREE.CatmullRomCurve3(Array.from({ length: 40 }, (_, i) => curve.getPointAt(wrap(front - 0.12 + (i / 39) * 0.24))));
  const band = new THREE.Mesh(new THREE.TubeGeometry(arc, 120, 1.6, 16, false), m.metal);
  band.scale.y = 3.5;
  group.add(band);
  group.add(chainAlong(curve, "rope", m, front + 0.12, front + 0.88));
  const f = flower(d, m, d.center);
  const out = outwardAt(curve, front);
  f.group.position.copy(curve.getPointAt(front)).addScaledVector(out, 2);
  f.group.quaternion.setFromUnitVectors(Y, out);
  group.add(f.group);
  const accentDia = Math.max(2, roundDiameter(d.accents.gem, d.accents.sizeCt));
  for (const s of [-1, 1]) {
    const params = Array.from({ length: 6 }, (_, i) => wrap(front + s * (0.03 + i * 0.015)));
    group.add(patternAt(d, m, params.map((u) => ({ pos: curve.getPointAt(u).addScaledVector(outwardAt(curve, u), 1.8), dia: accentDia * (1 - Math.abs(u - front) * 4), up: outwardAt(curve, u), tan: curve.getTangentAt(u) }))));
  }
  group.add(fringe(d, m, Array.from({ length: 9 }, (_, i) => { const u = wrap(front + (i / 8 - 0.5) * 0.12); return { pos: curve.getPointAt(u).addScaledVector(outwardAt(curve, u), 2).add(v3(0, -5.2, 0)), dir: v3(0, -1, 0).add(outwardAt(curve, u)).normalize() }; })));
  return { group, focus: f.group.position.clone(), focusSize: f.radius * 5, upright: false };
}

function handPiece(d: Design, m: Mats): Piece {
  const group = new THREE.Group();
  const { curve, front } = loopCurve(175, 1.12, 0);
  const wristOffset = v3(0, 0, -70);
  const wrist = chainAlong(curve, d.options.chain, m);
  wrist.position.copy(wristOffset);
  group.add(wrist);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(9, 0.9, 12, 80), m.metal);
  ring.rotation.x = Math.PI / 2; ring.position.set(0, 0, 70);
  group.add(ring);
  const f = flower(d, m, d.center);
  group.add(f.group);
  const ringFlower = flower(d, m, { ...d.center, lengthMm: 4, widthMm: 4, domeMm: 0.6 }, 1);
  ringFlower.group.position.set(0, 0.9, 70 - 9);
  group.add(ringFlower.group);
  // chains: one to the ring, three fanning to the bracelet
  group.add(chainAlong(new THREE.LineCurve3(v3(0, 0, f.radius), v3(0, 0, 70 - 9 - ringFlower.radius)), "fine", m));
  const wf = curve.getPointAt(front).add(wristOffset);
  for (const x of [-22, 0, 22]) {
    const end = v3(x, 0, wf.z - 1.5 + Math.abs(x) * 0.12);
    group.add(chainAlong(new THREE.CatmullRomCurve3([v3(x * 0.2, 0, -f.radius), v3(x * 0.6, 0, (wf.z - f.radius) / 2), end]), "fine", m));
  }
  return { group, focus: v3(), focusSize: f.radius * 6, upright: false };
}

export function buildPiece(d: Design): Piece {
  if (d.style.startsWith("motif")) return motifPiece(d, makeMaterials(d));
  if (d.type === "ring") return ringPiece(d);
  const m = makeMaterials(d);
  switch (d.type) {
    case "earrings": return earringPiece(d, m);
    case "necklace": return necklacePiece(d, m);
    case "bracelet": return braceletPiece(d, m);
    case "anklet": return ankletPiece(d, m);
    case "headpiece": return headpiecePiece(d, m);
    case "nose": return nosePiece(d, m);
    case "armlet": return armletPiece(d, m);
    case "hand": return handPiece(d, m);
  }
}
