import * as THREE from "three";
import { NO_CHARACTER, type Design, resolveClasp, roundDiameter } from "../design";
import { claspAt } from "./clasps";
import { type Piece, v3 } from "./common";
import { type Mats } from "./materials";
import { setStone, tube } from "./stones";
import { type Item, accents, chainAlong, fringe, jumpRing } from "./elements";
import { coin, flower, halo, patternRun } from "./patterns";
import { beadStrand, layeredLoop, loopCurve, outwardAt, place, spreadParams, wrap, yawAt } from "./curves";
import { dropStack } from "./drops";

export function necklacePiece(d: Design, m: Mats): Piece {
  const c = d.center, o = d.options, st = d.style;
  const group = new THREE.Group();
  const L = o.lengthIn * 25.4;
  const pointy = st === "pendant" || st === "lariat" || st === "rani-haar" || st === "mangalsutra" ? 0.22 : st === "line" || st === "riviera" || st === "by-the-yard" ? 0.16 : 0.08;
  const { curve, front } = loopCurve(L, 0.85, pointy);
  const fp = curve.getPointAt(front);
  let focus = fp.clone(), focusSize = Math.max(c.lengthMm, c.widthMm) * 2.5;
  const accentDia = roundDiameter(d.accents.gem, d.accents.sizeCt);
  const hang = (obj: THREE.Object3D, at: THREE.Vector3, len: number) => { obj.position.copy(at).add(v3(0, 0, len)); group.add(obj); return obj.position.clone(); };
  const inChain = (halfMm: number, joins: number[], ring: number) => {
    const total = curve.getLength();
    for (const x of [-halfMm, halfMm, ...joins]) group.add(jumpRing(m, ring, 0.14, curve.getPointAt(wrap(front + x / total)).add(v3(0, -0.1, 0))));
    const end = (halfMm + ring) / total;
    group.add(chainAlong(curve, o.chain, m, wrap(front + end), wrap(front + end) + 1 - 2 * end));
  };

  switch (st) {
    case "pendant": {
      if (o.hang === "in-chain") {
        const pend = new THREE.Group();
        pend.add(setStone(c, d.setting.style, m));
        let extra = 0;
        if (o.halo) { const h = halo(d, m, c); pend.add(h.group); extra = h.extent; }
        pend.position.copy(fp).add(v3(0, 0.3, 0));
        pend.rotation.y = yawAt(curve, front) - Math.PI / 2;
        group.add(pend);
        inChain(Math.max(c.lengthMm, c.widthMm) / 2 + extra + 0.6, [], 0.6);
        focus = fp.clone(); focusSize = Math.max(24, (c.lengthMm + extra * 2) * 2.5);
        break;
      }
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
    case "three-stone-pendant": {
      if (o.hang !== "in-chain") group.add(chainAlong(curve, o.chain, m));
      const side = d.sides.kind === "none" ? 0.72 : Math.min(0.95, Math.max(0.4, Math.cbrt(d.sides.sizeCt / Math.max(0.05, (c.carat ?? 1)))));
      const R = c.widthMm / 2, r = R * side;
      if (o.hang === "below" || o.hang === "drop") {
        const bail = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.45, 12, 32, Math.PI * 1.2), m.metal);
        bail.position.copy(fp).add(v3(0, 0, 0.6)); bail.rotation.set(Math.PI / 2, 0, -Math.PI * 0.1);
        group.add(bail);
        const pend = new THREE.Group();
        const L2 = c.lengthMm / 2, l2 = L2 * side;
        if (o.hang === "below") {
          for (const [x, k] of [[-(R + r + 0.3), side], [0, 1], [R + r + 0.3, side]] as const) {
            const s = setStone(c, d.setting.style, m, k);
            s.position.set(x, 0, L2 + (k === 1 ? 0 : -(L2 - l2)));
            pend.add(s);
          }
          pend.add(tube(m, [v3(-(R + r + 0.3), -0.5, 0.4), v3(0, -0.5, 0), v3(R + r + 0.3, -0.5, 0.4)], 0.35));
          pend.add(jumpRing(m, 0.7, 0.18, v3(0, -0.3, -0.7)));
        } else {
          let z = 0;
          [side, side, 1].forEach((k, i) => {
            const half = L2 * k;
            if (i) { pend.add(jumpRing(m, 0.5, 0.14, v3(0, -0.2, z + 0.35))); z += 0.7; }
            const s = setStone(c, d.setting.style, m, k);
            s.position.set(0, 0, z + half);
            pend.add(s);
            z += half * 2;
          });
        }
        pend.position.copy(fp).add(v3(0, 0, 2.4));
        group.add(pend);
        const box = new THREE.Box3().setFromObject(pend);
        focus = box.getCenter(new THREE.Vector3()); focusSize = Math.max(26, (box.max.z - box.min.z) * 1.8);
        break;
      }
      if (o.hang === "in-chain") {
        const ring = 0.55, gap = ring * 2 + 0.1;
        [-(R + gap + r), 0, R + gap + r].forEach((x, i) => {
          const s = setStone(c, d.setting.style, m, i === 1 ? 1 : side);
          s.position.copy(curve.getPointAt(wrap(front + x / curve.getLength()))).add(v3(0, 0.3, 0));
          group.add(s);
        });
        inChain(R + gap + 2 * r + ring, [-(R + gap / 2), R + gap / 2], ring);
        focus = fp.clone(); focusSize = 30;
        break;
      }
      const items: [number, number, number][] = [[-(R + r + 0.2), -0.7, side], [0, 0, 1], [R + r + 0.2, -0.7, side]];
      for (const [x, dz, k] of items) {
        const s = setStone(c, d.setting.style, m, k);
        s.position.copy(fp).add(v3(x, 0.3, 2.2 + R + dz));
        group.add(s);
      }
      for (const sx of [-1, 1]) group.add(jumpRing(m, 0.6, 0.15, fp.clone().add(v3(sx * (R + r + 0.2) * 1.3, -0.4, 2.2 + R - 0.7 - r))));
      focus = fp.clone().add(v3(0, 0, 2.2 + R)); focusSize = 30;
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
    case "line": {
      const kind = resolveClasp(st, o.clasp);
      const run = kind === "hidden" ? patternRun(d, m, curve, front, front + 1, { gap: 0.18, closed: true }) : patternRun(d, m, curve, front - 0.485, front + 0.485, { gap: 0.18 });
      group.add(run.group);
      const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 400, Math.max(0.35, run.maxW * 0.05), 8, true), m.metal);
      rail.position.y = -run.maxW * 0.42;
      group.add(rail);
      if (kind !== "hidden" && kind !== "none") group.add(claspAt(kind, d, m, curve, wrap(front + 0.5), run.maxW));
      focusSize = 60;
      break;
    }
    case "by-the-yard": {
      const loops = Math.max(1, Math.min(4, o.layers));
      const big = Math.max(c.widthMm, 2), small = big * 0.72, ringR = Math.max(0.7, big * 0.17);
      const stonesBig: Item[] = [], stonesSmall: Item[] = [], rings: Item[] = [];
      for (let l = 0; l < loops; l++) {
        const { curve: cv } = loopCurve(L / loops + l * 60, 0.85, 0.12 + l * 0.04);
        const total = cv.getLength();
        let at = 0, k = 0;
        while (at < total - big) {
          const dia = k % 2 ? small : big;
          const u = (at + dia / 2) / total;
          (k % 2 ? stonesSmall : stonesBig).push({ pos: cv.getPointAt(u), dia, yaw: yawAt(cv, u) });
          at += dia + 0.2;
          rings.push({ pos: cv.getPointAt(Math.min(0.999, (at + ringR) / total)), dia: ringR * 2, up: cv.getTangentAt(Math.min(0.999, (at + ringR) / total)) });
          at += ringR * 2 + 0.2; k++;
        }
      }
      const cutA = c.cut === "cabochon" ? "cabochon" : c.cut;
      group.add(accents(m, c.gem, c.color, cutA, stonesBig, "round"), accents(m, c.gem, c.color, cutA, stonesSmall, "round"));
      const ringIm = new THREE.InstancedMesh(new THREE.TorusGeometry(0.5, 0.11, 8, 20), m.metal, rings.length);
      const ob = new THREE.Object3D();
      rings.forEach((r, i) => { ob.position.copy(r.pos); ob.quaternion.setFromUnitVectors(v3(0, 0, 1), r.up!); ob.scale.setScalar(r.dia); ob.updateMatrix(); ringIm.setMatrixAt(i, ob.matrix); });
      group.add(ringIm);
      focusSize = 30;
      break;
    }
    case "gold-collar": {
      const span = 0.86, from = front - span / 2;
      const total = curve.getLength() * span, w = 8;
      const frameAt = (u: number) => { const p = curve.getPointAt(wrap(u)), t = curve.getTangentAt(wrap(u)), n = outwardAt(curve, u); return { p, t, n }; };
      const stones: Item[] = [], alt: Item[] = [];
      if (o.linkStyle === "x") {
        const seg = 9, n = Math.floor(total / seg);
        for (let i = 0; i < n; i++) {
          const u = from + ((i + 0.5) * seg) / curve.getLength();
          const { p, t, n: nn } = frameAt(u);
          for (const s1 of [-1, 1]) for (const lane of [-0.55, 0, 0.55]) {
            const a = p.clone().addScaledVector(t, -2.6).addScaledVector(nn, s1 * w * 0.42).addScaledVector(t, lane * 0.7);
            const b = p.clone().addScaledVector(t, 2.6).addScaledVector(nn, -s1 * w * 0.42).addScaledVector(t, lane * 0.7);
            group.add(tube(m, [a.clone().add(v3(0, 0.6, 0)), p.clone().addScaledVector(t, lane * 0.7).add(v3(0, 1.6 + s1 * 0.25, 0)), b.clone().add(v3(0, 0.6, 0))], 0.38));
          }
          const q = frameAt(u + (seg / 2) / curve.getLength());
          const base = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 12), m.metal);
          base.scale.set(1, 0.45, 1); base.position.copy(q.p); group.add(base);
          const sd = Math.max(0.9, roundDiameter(d.accents.gem, d.accents.sizeCt));
          for (const [dx, dz] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [0.7, 0.7], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7]])
            stones.push({ pos: q.p.clone().addScaledVector(q.t, dx * sd * 1.05).addScaledVector(q.n, dz * sd * 1.05).add(v3(0, 1.15 - Math.hypot(dx, dz) * 0.25, 0)), dia: sd });
        }
      } else {
        const seg = 2.4, n = Math.floor(total / seg);
        const sd = Math.max(0.8, roundDiameter(d.accents.gem, d.accents.sizeCt));
        for (let i = 0; i < n; i++) {
          const u = from + (i * seg) / curve.getLength();
          const { p, t, n: nn } = frameAt(u);
          const tip = p.clone().add(v3(0, 1.4, 0)), l = p.clone().addScaledVector(nn, w / 2).addScaledVector(t, -2.2).add(v3(0, 0.6, 0)), r = p.clone().addScaledVector(nn, -w / 2).addScaledVector(t, -2.2).add(v3(0, 0.6, 0));
          group.add(tube(m, [l, tip, r], 0.62));
          if (i % 3 === 1) {
            const row = Math.floor(i / 3) % 2 === 0 ? stones : alt;
            for (const end of [l, r]) for (let k = 1; k <= 3; k++) row.push({ pos: tip.clone().lerp(end, k / 4).add(v3(0, 0.55, 0)), dia: sd });
          }
        }
      }
      group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, stones));
      if (alt.length) group.add(accents(m, "diamond", "#f4f6fb", "faceted", alt));
      focusSize = 50;
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
      const span = 0.42;
      const line = d.accents.enabled ? patternRun(d, m, curve, front - span / 2 - 0.03, front + span / 2 + 0.03, { gap: 0.15 }) : null;
      if (line) group.add(line.group);
      const lineW = line ? line.maxW : 0;
      group.add(chainAlong(curve, "box", m, front + span / 2 + 0.03, front + 1 - span / 2 - 0.03));
      const params = spreadParams(front, o.count, span);
      params.forEach((u, i) => {
        const k = 1 - Math.abs(i - (params.length - 1) / 2) / ((params.length - 1) / 2 || 1);
        const short = params.length > 6 && i % 2 === 1;
        const scale = (0.45 + 0.55 * k) * (short ? 0.7 : 1);
        const s = setStone({ ...c, ...NO_CHARACTER, shape: c.shape === "round" ? "pear" : c.shape }, d.setting.style, m, scale);
        const out = outwardAt(curve, u);
        const linkLen = short ? 0.6 : 1.5 + k * 4;
        const base = curve.getPointAt(u).addScaledVector(out, lineW / 2 + 0.3);
        s.position.copy(base).addScaledVector(out, linkLen + (c.lengthMm * scale) / 2);
        s.quaternion.setFromUnitVectors(v3(0, 0, -1), out.clone().negate());
        if (c.shape === "pear") s.rotateY(Math.PI);
        group.add(s);
        if (!short && linkLen > 1) {
          group.add(accents(m, d.accents.gem, d.accents.color, d.accents.cut, [{ pos: base.clone().addScaledVector(out, linkLen * 0.5), dia: Math.min(accentDia * 1.4, linkLen * 0.8) }]));
          group.add(tube(m, [base, base.clone().addScaledVector(out, linkLen)], 0.18));
        }
      });
      focusSize = 70;
      break;
    }
    case "briolette-fringe": {
      const rows = Math.max(1, Math.min(7, o.layers));
      const n = Math.max(5, o.count);
      const drop = { ...c, ...NO_CHARACTER, cut: "briolette" as const, rotation: 0 };
      for (let r = 0; r < rows; r++) {
        const { curve: cv, front: fr } = r ? layeredLoop(L, r * 22, 0.85, 0.1) : { curve, front };
        group.add(chainAlong(cv, "fine", m, wrap(fr + 0.3), wrap(fr + 0.3) + 0.4));
        const span = 0.6 - r * 0.02;
        const line = patternRun(d, m, cv, fr - span / 2, fr + span / 2, { gap: 0.2 });
        group.add(line.group);
        spreadParams(fr, n, span * 0.92).forEach((u, i) => {
          const k = 1 - Math.abs(i - (n - 1) / 2) / ((n - 1) / 2 || 1);
          const out = outwardAt(cv, u);
          const s = setStone(drop, d.setting.style, m, 0.75 + 0.25 * k);
          s.position.copy(cv.getPointAt(u)).addScaledVector(out, line.maxW / 2 + 0.6 + (c.lengthMm * (0.75 + 0.25 * k)) / 2);
          s.quaternion.setFromUnitVectors(v3(0, 0, -1), out.clone().negate());
          s.rotateY(Math.PI);
          group.add(s);
        });
      }
      focusSize = 80;
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
      const layers = Math.max(1, o.layers);
      for (let i = 0; i < layers; i++) {
        const { curve: cv, front: fr } = layeredLoop(L, i * 38, 0.85, 0.08);
        const kind = resolveClasp(st, o.clasp);
        group.add(kind === "hidden"
          ? beadStrand(m, cv, d.fringe.gem, d.fringe.color, d.fringe.sizeMm, 0, fr, fr + 1)
          : beadStrand(m, cv, d.fringe.gem, d.fringe.color, d.fringe.sizeMm, 0, fr + 0.505, fr + 1.495));
        if (i === 0 && kind !== "hidden" && kind !== "none") group.add(claspAt(kind, d, m, cv, wrap(fr + 0.5), Math.max(3, d.fringe.sizeMm * 0.9)));
      }
      focusSize = d.fringe.sizeMm * 10;
    }
  }
  if (CHAIN_STYLES_WITH_CLASP.has(st)) {
    const kind = resolveClasp(st, o.clasp);
    if (kind !== "none" && kind !== "hidden") group.add(claspAt(kind, d, m, curve, wrap(front + 0.5), 3.2));
  }
  return { group, focus, focusSize, upright: false };
}

const CHAIN_STYLES_WITH_CLASP = new Set(["pendant", "drop-pendant", "three-stone-pendant", "station"]);
