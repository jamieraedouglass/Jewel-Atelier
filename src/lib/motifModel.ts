import * as THREE from "three";
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js";
import type { Motif } from "./design";

/**
 * Turns a motif (SVG path + stone positions) into a flat gold plate lying in the XZ plane, top face at y = 0.
 * SVG y runs down the page; here it runs toward +Z, so the bottom of a drawing hangs toward the viewer.
 */

export type MotifShapes = { shapes: THREE.Shape[]; scale: number; toLocal: (x: number, y: number) => THREE.Vector3; size: { w: number; h: number } };

const shapeCache = new Map<string, MotifShapes | null>();

export function motifShapes(m: Motif): MotifShapes | null {
  const [minX, minY, vw, vh] = m.viewBox;
  const key = `${m.path.length}:${m.path.slice(0, 200)}:${m.path.slice(-200)}:${m.viewBox.join(",")}:${m.widthMm}`;
  if (shapeCache.has(key)) return shapeCache.get(key)!;
  let result: MotifShapes | null = null;
  try {
    if (typeof DOMParser === "undefined") return null;
    const data = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${vw} ${vh}"><path d="${m.path}"/></svg>`);
    const shapes = data.paths.flatMap((p) => SVGLoader.createShapes(p));
    if (shapes.length) {
      // scale so the drawing's wider side equals widthMm, centred on the view box
      const scale = m.widthMm / Math.max(vw, vh);
      const cx = minX + vw / 2, cy = minY + vh / 2;
      const toLocal = (x: number, y: number) => new THREE.Vector3((x - cx) * scale, 0, (y - cy) * scale);
      const scaled = shapes.map((s) => {
        const pts = s.getPoints(48).map((p) => { const v = toLocal(p.x, p.y); return new THREE.Vector2(v.x, v.z); });
        const out = new THREE.Shape(pts);
        out.holes = s.holes.map((h) => new THREE.Path(h.getPoints(48).map((p) => { const v = toLocal(p.x, p.y); return new THREE.Vector2(v.x, v.z); })));
        return out;
      });
      result = { shapes: scaled, scale, toLocal, size: { w: vw * scale, h: vh * scale } };
    }
  } catch {
    result = null;
  }
  shapeCache.set(key, result);
  return result;
}

/** extrude the plate; optional inset layer (enamel) and an edge finish */
export function motifPlate(m: Motif, metal: THREE.Material, enamel: THREE.Material | null): THREE.Group {
  const g = new THREE.Group();
  const ms = motifShapes(m);
  if (!ms) {
    // fall back to a simple disc so the piece still renders
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(m.widthMm / 2, m.widthMm / 2, m.thicknessMm, 48), metal);
    disc.position.y = -m.thicknessMm / 2;
    g.add(disc);
    return g;
  }
  const bevel = Math.min(0.35, m.thicknessMm * 0.25);
  const geo = new THREE.ExtrudeGeometry(ms.shapes, { depth: m.thicknessMm - bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 24 });
  geo.rotateX(Math.PI / 2); // shape Y → +Z, depth goes down
  geo.translate(0, -bevel, 0);
  g.add(new THREE.Mesh(geo, metal));

  if (enamel) {
    // enamel inlay: the same shape shrunk toward its centre, sitting just above the gold
    const box = new THREE.Box2();
    ms.shapes.forEach((s) => s.getPoints(24).forEach((p) => box.expandByPoint(p)));
    const c = box.getCenter(new THREE.Vector2());
    const inset = ms.shapes.map((s) => {
      const k = 0.86;
      const sh = new THREE.Shape(s.getPoints(48).map((p) => p.clone().sub(c).multiplyScalar(k).add(c)));
      sh.holes = s.holes.map((h) => {
        const hp = h.getPoints(48), hc = hp.reduce((acc, p) => acc.add(p), new THREE.Vector2()).divideScalar(hp.length);
        return new THREE.Path(hp.map((p) => p.clone().sub(hc).multiplyScalar(1.15).add(hc)));
      });
      return sh;
    });
    const eg = new THREE.ExtrudeGeometry(inset, { depth: 0.25, bevelEnabled: false, curveSegments: 24 });
    eg.rotateX(Math.PI / 2); eg.translate(0, 0.12, 0);
    g.add(new THREE.Mesh(eg, enamel));
  }

  if (m.edge !== "smooth") {
    for (const s of ms.shapes) {
      const outline = s.getSpacedPoints(Math.max(24, Math.round(s.getLength() / (m.edge === "rope" ? 0.9 : 0.55))));
      const pts = outline.map((p) => new THREE.Vector3(p.x, 0.05, p.y));
      if (m.edge === "rope") {
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), pts.length * 2, 0.32, 8, true), metal));
      }
      const bead = new THREE.SphereGeometry(m.edge === "rope" ? 0.26 : 0.22, 8, 6);
      const im = new THREE.InstancedMesh(bead, metal, pts.length);
      const M = new THREE.Matrix4();
      pts.forEach((p, i) => { M.makeTranslation(p.x, p.y + (m.edge === "rope" ? 0.2 : 0.08), p.z); im.setMatrixAt(i, M); });
      g.add(im);
    }
  }
  return g;
}

/** a small preview of a motif as an SVG string for the controls panel */
export function motifPreviewSvg(m: Motif, stroke = "#d9c38a") {
  const [x, y, w, h] = m.viewBox;
  const pad = Math.max(w, h) * 0.06;
  const stones = m.stones
    .map((s) => `<circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="${s.kind === "center" ? "#6f8cff" : "#f4f6fb"}" opacity="0.9"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}"><path d="${m.path}" fill="${stroke}" fill-opacity="0.35" stroke="${stroke}" stroke-width="${Math.max(w, h) / 120}" fill-rule="evenodd"/>${stones}</svg>`;
}
