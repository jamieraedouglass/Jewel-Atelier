import * as THREE from "three";
import { BEAD_GEMS, type Design, SOLID_BRACELETS, bangleDiameter, resolveClasp, roundDiameter } from "../design";
import { claspAt, claspGap } from "./clasps";
import { type Piece, Y, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone } from "./stones";
import { type Item, accents, balls, chainAlong } from "./elements";
import { patternMaxW, patternRun } from "./patterns";
import { beadStrand, loopCurve, outwardAt, place, spreadParams, wrap, yawAt } from "./curves";
import { decoFrames, haloRing } from "./ringHeads";
import { type Mats as M } from "./materials";

export function braceletPiece(d: Design, m: Mats, circumference?: number): Piece {
  const c = d.center, o = d.options, st = d.style;
  const group = new THREE.Group();
  const solid = SOLID_BRACELETS.has(st);
  const circ = circumference ?? (solid ? Math.PI * bangleDiameter(o.bangleSize) : o.wristCm * 10 + 15);
  const { curve, front } = loopCurve(circ, 1.12, 0);
  const fp = curve.getPointAt(front);
  let focus = fp.clone(), focusSize = 24;
  const accentDia = roundDiameter(d.accents.gem, d.accents.sizeCt);
  const outFront = outwardAt(curve, front);

  if (st === "tennis") {
    const rows = Math.max(1, Math.min(5, o.layers));
    const W0 = patternMaxW(d);
    const haloItems: Item[] = [];
    const pitch = W0 + (o.halo ? Math.max(0.55, W0 * 0.17) * 2 + 0.5 : 0.5);
    let maxW = W0;
    const kind = resolveClasp(st, o.clasp);
    const gapU = kind === "hidden" ? 0 : claspGap(curve, W0 + (rows - 1) * pitch) / 2;
    for (let r = 0; r < rows; r++) {
      const off = (r - (rows - 1) / 2) * pitch;
      const run = patternRun(d, m, curve, gapU ? front + 0.5 + gapU : front, gapU ? front + 1.5 - gapU : front + 1, {
        closed: !gapU, gap: o.halo ? Math.max(0.55, W0 * 0.17) * 2 + 0.6 : 0.45,
        offset: (u) => outwardAt(curve, u).multiplyScalar(off),
        onPlace: o.halo ? (pos, quat, W, L, shape) => haloRing(pos, quat, W, L, haloItems, shape) : undefined,
      });
      group.add(run.group);
      maxW = run.maxW;
      const path = run.path ?? curve;
      const n = run.path ? 400 : 200;
      const rail = off ? new THREE.CatmullRomCurve3(Array.from({ length: n }, (_, k) => path.getPointAt(k / n).addScaledVector(outwardAt(curve, k / n), off)), true) : path;
      const under = new THREE.Mesh(new THREE.TubeGeometry(rail, 400, Math.max(0.45, run.maxW * 0.08), 8, true), m.metal);
      under.position.y = -run.maxW * 0.45;
      group.add(under);
    }
    if (haloItems.length) group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, haloItems));
    if (kind !== "hidden" && kind !== "none") group.add(claspAt(kind, d, m, curve, wrap(front + 0.5), W0 + (rows - 1) * pitch));
    focusSize = maxW * 7 + (rows - 1) * pitch * 2;
    if (d.fringe.enabled) {
      const reach = ((rows - 1) / 2) * pitch + maxW / 2;
      group.add(tassel(d, m, curve.getPointAt(front).addScaledVector(outFront, reach + 0.6), outFront));
      focusSize = Math.max(focusSize, 60);
    }
  } else if (st === "openwork") {
    const motif = () => { const g = new THREE.Group(); g.add(setStone(c, d.setting.style, m)); const f = decoFrames(d, m, c); g.add(f.group); return { g, extent: f.extent }; };
    const first = motif();
    const long = first.extent, short = c.widthMm / 2 + (first.extent - c.lengthMm / 2);
    const rowPitch = long * 2 + 0.8;
    const rows = Math.max(1, Math.min(o.layers, Math.floor(55 / rowPitch) || 1));
    const beads: Item[] = [];
    const bead = Math.max(1.4, roundDiameter(d.accents.gem, d.accents.sizeCt) * 1.6);
    for (let r = 0; r < rows; r++) {
      const off = (r - (rows - 1) / 2) * rowPitch, shift = r % 2 ? 0.5 : 0;
      const rail = new THREE.CatmullRomCurve3(Array.from({ length: 200 }, (_, k) => curve.getPointAt(k / 200).addScaledVector(outwardAt(curve, k / 200), off)), true);
      const per = Math.max(3, Math.floor(rail.getLength() / (short * 2 + bead + 0.6)));
      for (let i = 0; i < per; i++) {
        const u = wrap(front + (i + shift) / per);
        const mm = r === 0 && i === 0 ? first : motif();
        const out = outwardAt(curve, u);
        group.add(place(mm.g, curve.getPointAt(u).addScaledVector(out, off), yawAt(curve, u)));
        const un = wrap(u + 0.5 / per), on = outwardAt(curve, un);
        beads.push({ pos: curve.getPointAt(un).addScaledVector(on, off).add(v3(0, -0.2, 0)), dia: bead });
        if (r < rows - 1) beads.push({ pos: curve.getPointAt(un).addScaledVector(on, off + rowPitch / 2).add(v3(0, -0.2, 0)), dia: bead * 1.2 });
      }
      const under = new THREE.Mesh(new THREE.TubeGeometry(rail, 400, 0.35, 8, true), m.metal);
      under.position.y = -1.2;
      group.add(under);
    }
    group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, beads));
    focus = curve.getPointAt(front);
    focusSize = long * 2 * rows + 30;
  } else if (st === "open-bangle") {
    const thick = 2.2;
    const arc = new THREE.CatmullRomCurve3(Array.from({ length: 120 }, (_, i) => curve.getPointAt(wrap(front + 0.05 + (i / 119) * 0.9))));
    const band = new THREE.Mesh(new THREE.TubeGeometry(arc, 300, thick, 20, false), m.metal);
    band.scale.y = 1.3;
    group.add(band);
    if (o.pave) group.add(patternRun(d, m, arc, 0.02, 0.32, { offset: () => v3(0, thick * 1.25, 0), maxW: thick * 1.5, gap: 0.2 }).group);
    for (const u of [0, 1]) {
      const p = arc.getPointAt(u), t = arc.getTangentAt(u).multiplyScalar(u === 0 ? -1 : 1);
      const s = setStone(c, d.setting.style, m, Math.min(1, 14 / Math.max(c.lengthMm, c.widthMm)));
      s.position.copy(p).addScaledVector(t, -Math.min(c.lengthMm, 14) / 2 + 1).add(v3(0, thick * 1.25, 0));
      s.rotation.y = Math.atan2(t.x, t.z);
      group.add(s);
    }
    focus = curve.getPointAt(front).add(v3(0, thick, 0)); focusSize = 40;
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
    group.add(chainAlong(curve, o.chain, m));
    for (let i = 0; i < o.count; i++) {
      const u = wrap(front + i / o.count);
      group.add(place(setStone(c, d.setting.style, m), curve.getPointAt(u).add(v3(0, 0.2, 0)), yawAt(curve, u)));
    }
  }
  if (st === "station" || st === "charm" || st === "beaded") {
    const kind = resolveClasp(st, o.clasp);
    if (kind !== "none" && kind !== "hidden") group.add(claspAt(kind, d, m, curve, wrap(front + 0.5), st === "beaded" ? Math.max(3, d.fringe.sizeMm) : 3.2));
  }
  return { group, focus, focusSize, upright: false };
}

function tassel(d: Design, m: M, at: THREE.Vector3, dir: THREE.Vector3) {
  const g = new THREE.Group();
  g.userData.part = "fringe";
  const cap = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 16), m.metal);
  cap.scale.set(1, 0.8, 1.25);
  cap.position.copy(at).addScaledVector(dir, 2.4);
  g.add(cap);
  const capStones: Item[] = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return { pos: cap.position.clone().add(v3(Math.cos(a) * 1.9, 1.2, Math.sin(a) * 1.9)), dia: 0.9 };
  });
  g.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, capStones));
  const D = Math.min(3.5, Math.max(1, d.fringe.sizeMm * 0.5));
  const strands = 11, len = 32, side = new THREE.Vector3().crossVectors(Y, dir).normalize();
  const stones: Item[] = [];
  for (let k = 0; k < strands; k++) {
    const spread = (k / (strands - 1) - 0.5) * 0.5;
    const way = dir.clone().applyAxisAngle(Y, spread);
    const start = cap.position.clone().addScaledVector(dir, 2.2).addScaledVector(side, spread * 4);
    const n = Math.floor((len * (0.85 + 0.15 * Math.cos(spread * 6))) / (D + 0.15));
    for (let i = 0; i < n; i++) stones.push({ pos: start.clone().addScaledVector(way, i * (D + 0.15)).add(v3(0, (k % 2) * 0.4, 0)), dia: D, up: Y });
  }
  g.add(BEAD_GEMS.has(d.fringe.gem) ? balls(m.bead(d.fringe.gem, d.fringe.color), stones) : accents(m, d.fringe.gem, d.fringe.color, "faceted", stones));
  return g;
}
