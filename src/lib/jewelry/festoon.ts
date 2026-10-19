import * as THREE from "three";
import { type Design, estimateDims, resolveClasp } from "../design";
import { claspAt } from "./clasps";
import { v3 } from "./common";
import { type Mats } from "./materials";
import { ASPECT } from "./elements";
import { patternRun } from "./patterns";
import { tube } from "./stones";
import { outwardAt, wrap } from "./curves";

// A festoon necklace in the manner of the 1950s Cartier pieces: a line of round stones (the centre stone's) all the
// way round the neck, and across the front swags of several rows of the accent stones (baguettes, set across the
// row) draped between ornaments, plates set with the same stones where the rows gather. Each row of a swag is the
// swag's curve offset square to itself, so the rows nest evenly without touching.
// Swags: options.count (1-4). Rows per swag: options.layers (1-5).
export function festoon(d: Design, m: Mats, curve: THREE.Curve<THREE.Vector3>, front: number) {
  const g = new THREE.Group(), c = d.center, o = d.options;
  const total = curve.getLength();

  // The line round the neck: the centre stone's gem and size, as a pattern of its own.
  const top = d.accents.sizeCt;
  const rounds: Design = { ...d, accents: { ...d.accents, gem: c.gem, color: c.color, cut: c.cut === "rose-cut" || c.cut === "polki" ? c.cut : "faceted", shapes: [c.shape], sizes: [c.widthMm / estimateDims(c.gem, c.cut, c.shape, top).widthMm], turns: [], orientation: "along", layout: "line" } };
  const kind = resolveClasp("festoon", o.clasp);
  const line = kind === "hidden"
    ? patternRun(rounds, m, curve, front, front + 1, { editKey: "festoonTop", gap: 0.18, closed: true })
    : patternRun(rounds, m, curve, front - 0.485, front + 0.485, { editKey: "festoonTop", gap: 0.18 });
  g.add(line.group);
  // A gold rail under the line ties its stones, the clasp and the ornaments into one piece.
  const railR = Math.max(0.35, line.maxW * 0.05), railY = -railR * 0.6;
  const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, railR, 8, true), m.metal);
  rail.position.y = railY;
  g.add(rail);
  if (kind !== "hidden" && kind !== "none") g.add(claspAt(kind, d, m, curve, wrap(front + 0.5), line.maxW));

  // The rows: how far one row sits from the next is the stone's reach across the row, plus a little gold between.
  const e = estimateDims(d.accents.gem, d.accents.cut, d.accents.shapes[0] ?? "baguette", d.accents.sizeCt);
  const shape = d.accents.shapes[0] ?? "baguette";
  const across = d.accents.orientation === "across" ? e.widthMm * ASPECT[shape] : e.widthMm;
  const pitch = across + 0.45;
  const swags = Math.max(1, Math.min(4, o.count)), rows = Math.max(1, Math.min(5, o.layers));
  const span = Math.min(0.4, 0.16 + swags * 0.06);
  const depth = Math.max(10, (span * total) / swags / 3.2);

  const inner = depth * 0.55;
  // Everything hangs the same way: down the front, as it falls when worn.
  const down = outwardAt(curve, front);
  // Ornaments: at both ends on the line, and between swags lower down, where neighbouring swags meet.
  const anchors = Array.from({ length: swags + 1 }, (_, i) => {
    const low = i > 0 && i < swags ? inner : 0;
    return curve.getPointAt(wrap(front + (i / swags - 0.5) * span)).addScaledVector(down, line.maxW / 2 + across / 2 + 0.8 + low);
  });
  const bar = Math.max(3.2, across * 1.3);
  // Each swag is one curve sagging between two ornaments; its rows are that curve offset square to itself, one below
  // another, so they keep the same spacing all along, as swags hang. At an ornament on the line the rows fan out
  // under it; where two swags meet, each swag's rows stop at the bar down the middle of the ornament between them.
  const ends: { at: THREE.Vector3; dir: THREE.Vector3 }[] = [];
  const reachAt = new Map<number, number>();
  for (let s = 0; s < swags; s++) {
    const a = anchors[s], b = anchors[s + 1];
    // Straight across the front, from this swag's first ornament towards its second.
    const side = new THREE.Vector3().crossVectors(v3(0, 1, 0), down).normalize();
    if (side.dot(b.clone().sub(a)) < 0) side.negate();
    const base = new THREE.QuadraticBezierCurve3(a, a.clone().add(b).multiplyScalar(0.5).addScaledVector(down, depth * 2), b);
    const below = (t: number) => { const n = new THREE.Vector3().crossVectors(base.getTangent(t), v3(0, 1, 0)).normalize(); return n.dot(down) < 0 ? n.negate() : n; };
    if (s === 0) ends.push({ at: a, dir: below(0) });
    if (s === swags - 1) ends.push({ at: b, dir: below(1) });
    for (let r = 0; r < rows; r++) {
      const pts = Array.from({ length: 81 }, (_, k) => base.getPoint(k / 80).addScaledVector(below(k / 80), r * pitch));
      const row = new THREE.CatmullRomCurve3(pts, false, "centripetal");
      // Clear of the middle bar: stop where the row reaches it.
      const clear = (u: number, at: THREE.Vector3, sgn: number) => row.getPointAt(u).sub(at).dot(side) * sgn < -(bar / 2 + 0.3);
      let from = 0.04, to = 0.96;
      if (s > 0) { while (from < 0.5 && !clear(from, a, -1)) from += 0.002; reachAt.set(s, Math.max(reachAt.get(s) ?? 0, row.getPointAt(from).sub(a).dot(down))); }
      if (s < swags - 1) { while (to > 0.5 && !clear(to, b, 1)) to -= 0.002; reachAt.set(s + 1, Math.max(reachAt.get(s + 1) ?? 0, row.getPointAt(to).sub(b).dot(down))); }
      g.add(patternRun(d, m, row, from, to, { editKey: `festoon${s}-${r}`, gap: 0.12 }).group);
    }
  }
  // Each ornament: a gold bar set with a line of the same stones. On the line it lies across the ends of the rows;
  // between swags it runs straight down, as far as the lowest row reaches it.
  const ornament = (at: THREE.Vector3, dir: THREE.Vector3, length: number) => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(bar, 0.9, length + 1.6), m.metal);
    plate.position.copy(at).addScaledVector(dir, length * 0.5).add(v3(0, -0.35, 0));
    plate.quaternion.setFromUnitVectors(v3(0, 0, 1), dir);
    g.add(plate);
    const spine = new THREE.LineCurve3(at.clone().addScaledVector(dir, -0.3), at.clone().addScaledVector(dir, length + 0.3));
    g.add(patternRun({ ...d, accents: { ...d.accents, orientation: "along" } }, m, spine, 0, 1, { gap: 0.1, maxW: across }).group);
  };
  for (const e of ends) ornament(e.at, e.dir, (rows - 1) * pitch);
  // The ornaments on the line hang from it by a short gold link down to the rail.
  for (const e of ends) {
    const top = curve.getPointAt(wrap(front + (e === ends[0] ? -0.5 : 0.5) * span)).add(v3(0, railY, 0));
    g.add(tube(m, [top, e.at.clone().add(v3(0, -0.35, 0))], Math.max(0.45, railR)));
  }
  for (let i = 1; i < swags; i++) ornament(anchors[i], down, Math.max((rows - 1) * pitch, (reachAt.get(i) ?? 0) + pitch / 2));
  const low = anchors[Math.floor(swags / 2)].clone().addScaledVector(down, depth * 0.5);
  return { group: g, focus: low, focusSize: Math.max(70, span * total * 1.2) };
}
