import { applyGlow, cabochonBody } from "../glow";
import { handPolished } from "../polish";
import * as THREE from "three";
import { type Design, ringInnerDiameter, sideStoneDims } from "../design";
import { cabochonGeo, carvedGeo, centerFacetedGeo, clawDegrees, outlineFn, roseCutGeo, sideStoneGeo } from "./stoneGeometry";
import { metalTone, textureBump } from "./metal";
import { bandSection, shankGeo } from "./band";
import { inclusionSpecks, phenomenonLayer, seeThrough } from "../jewelry/character";
import { canHug } from "../design/buildRules";

export function buildRing(d: Design): THREE.Group {
  const root = new THREE.Group();
  const tone = metalTone(d);
  const metal = handPolished(new THREE.MeshPhysicalMaterial({ color: tone.color, metalness: 1, roughness: tone.roughness, envMapIntensity: 1.05, clearcoat: 0.3, clearcoatRoughness: 0.1 }));
  const bandMetal = handPolished(metal.clone());
  if (d.band.finish === "textured") {
    const bump = textureBump();
    if (bump) { bandMetal.bumpMap = bump; bandMetal.bumpScale = 0.6; bandMetal.roughness = tone.roughness + 0.12; }
  }
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

  const RIN = ringInnerDiameter(d.ringSize) / 2;
  const shankMesh = new THREE.Mesh(shankGeo(RIN, d.band.widthMm, d.band.finish, undefined, d.band.shape, d.band.split), bandMetal);
  shankMesh.userData.shank = true;
  root.add(shankMesh);
  const SHANK_TOP = RIN + 2.3;

  const head = new THREE.Group();
  root.add(head);
  root.userData.head = head;
  const c = d.center;
  const L = c.lengthMm, W = c.widthMm, fn = outlineFn(c.shape, L, W);
  const isCab = c.cut === "cabochon" || c.cut === "bead" || c.cut === "carved";
  const belly = isCab ? Math.min(W * 0.14, 2) : W * 0.43;
  const GY = SHANK_TOP + (isCab ? belly * 0.56 : belly * 0.45) + d.setting.height * 4;
  const color = new THREE.Color(c.color);
  const colorless = c.gem === "diamond" || c.gem === "aquamarine";
  const stoneMat = applyGlow(new THREE.MeshPhysicalMaterial({
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
  }), c.glow, isCab);
  if (isCab && c.cut !== "bead") cabochonBody(stoneMat);
  const stone = new THREE.Group();
  stone.userData.part = "center";
  if (isCab) stone.add(new THREE.Mesh(c.cut === "carved"
    ? carvedGeo(fn, c.domeMm, belly, Math.round(Math.max(12, Math.min(36, (Math.PI * (L + W)) / 2 / 2.2))))
    : cabochonGeo(fn, c.domeMm, belly), stoneMat));
  else {
    const g = centerFacetedGeo(c.shape, fn, W, Math.max(0.6, c.domeMm));
    const inner = mirror.clone(); inner.color = colorless ? new THREE.Color(0xf2f5ff) : color.clone().lerp(new THREE.Color(0xffffff), 0.15);
    stone.add(new THREE.Mesh(g, inner), new THREE.Mesh(g, stoneMat));
  }
  if (isCab && c.cut !== "bead") {
    const star = phenomenonLayer(c, (stone.children[0] as THREE.Mesh).geometry, L, W);
    if (star) stone.add(star);
  }
  if (c.cut !== "bead") {
    const specks = inclusionSpecks(c, fn, L, W, Math.max(0.25, c.domeMm));
    if (specks) { seeThrough(stone); stone.add(specks); }
  }
  stone.position.y = GY;
  head.add(stone);

  const loop = (s: number, y: number, n = 96) => Array.from({ length: n }, (_, i) => { const [x, z] = fn(i / n); return new THREE.Vector3(x * s, y, z * s); });
  const lowRailY = GY - Math.min(belly, 2) - 0.1;
  if (d.band.profile !== "flush") head.add(tube(loop(0.7, lowRailY), 0.42, true));
  if (d.band.profile === "flush") {
    const shape = new THREE.Shape(loop(1.035, 0).map((p) => new THREE.Vector2(p.x, p.z)));
    shape.holes.push(new THREE.Path(loop(0.985, 0).reverse().map((p) => new THREE.Vector2(p.x, p.z))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 2, curveSegments: 64 });
    g.rotateX(Math.PI / 2); g.translate(0, GY + 0.12, 0); g.computeVertexNormals();
    head.add(new THREE.Mesh(g, metal));
  } else if (d.setting.style === "bezel" && d.style === "deco") {
    const shape = new THREE.Shape(loop(1.04, 0).map((p) => new THREE.Vector2(p.x, p.z)));
    shape.holes.push(new THREE.Path(loop(0.985, 0).reverse().map((p) => new THREE.Vector2(p.x, p.z))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.1, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.05, bevelSegments: 2, curveSegments: 64 });
    g.rotateX(Math.PI / 2); g.translate(0, GY + 0.2, 0); g.computeVertexNormals();
    head.add(new THREE.Mesh(g, metal));
    const beads = loop(1.06, GY + 0.24, Math.max(40, Math.round((Math.PI * (L + W)) / 2 / 0.32)));
    const bead = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), metal, beads.length);
    const o = new THREE.Object3D();
    beads.forEach((b, i) => { o.position.copy(b); o.updateMatrix(); bead.setMatrixAt(i, o.matrix); });
    head.add(bead);
  } else if (d.setting.style === "bezel") {
    const shape = new THREE.Shape(loop(1.09, 0).map((p) => new THREE.Vector2(p.x, p.z)));
    shape.holes.push(new THREE.Path(loop(0.98, 0).reverse().map((p) => new THREE.Vector2(p.x, p.z))));
    const g = new THREE.ExtrudeGeometry(shape, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.15, bevelSegments: 4, curveSegments: 64 });
    g.rotateX(Math.PI / 2); g.translate(0, GY + 0.55, 0); g.computeVertexNormals();
    head.add(new THREE.Mesh(g, metal));
  } else {
    head.add(tube(loop(0.95, GY - 0.55), 0.38, true));
    const hugging = d.sides.kind !== "none" && d.sides.hug && canHug(d.sides.kind) && d.sides.follow !== "band";
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

  if (d.band.profile !== "flush") for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [x, z] = fn(((sx > 0 ? (sz > 0 ? 45 : 315) : sz > 0 ? 135 : 225)) / 360);
    root.add(tube([new THREE.Vector3(x * 0.49, lowRailY, z * 0.49), new THREE.Vector3(sx * 2.4, SHANK_TOP - 0.9, sz * 1.3), new THREE.Vector3(sx * 2.6, SHANK_TOP - 1.7, sz * 1.1)], 0.5));
  }

  if (d.gallery.roseCut && d.gallery.under === "hidden-halo") {
    const r = Math.max(0.4, Math.min(0.75, Math.min(L, W) * 0.08));
    const y = GY - Math.min(belly, 2) * 0.55;
    const ring = loop(0.86, y, 240);
    let per = 0;
    for (let i = 0; i < ring.length; i++) per += ring[i].distanceTo(ring[(i + 1) % ring.length]);
    const n = Math.max(8, Math.floor(per / (r * 2 + 0.12)));
    const rg = roseCutGeo(r, r * 0.55);
    const haloMat = d.gallery.color.toLowerCase() === "#f4f6fb" ? roseMat : roseMat.clone();
    if (haloMat !== roseMat) haloMat.color.set(d.gallery.color);
    const hh = new THREE.Group();
    hh.userData.part = "accents";
    hh.userData.keep = true;
    for (let i = 0; i < n; i++) {
      const [x, z] = fn(i / n), out = new THREE.Vector3(x, 0, z).normalize();
      const s = new THREE.Mesh(rg, haloMat);
      s.position.set(x * 0.86 + out.x * 0.25, y, z * 0.86 + out.z * 0.25);
      s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), out.clone().add(new THREE.Vector3(0, 0.35, 0)).normalize());
      hh.add(s);
    }
    hh.add(tube(loop(0.84, y - r * 0.9), 0.16, true));
    head.add(hh);
  }

  if (d.gallery.roseCut && d.gallery.under !== "hidden-halo") {
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

  if (d.sides.kind !== "none") {
    const asp = { "half-moon": 0.46, trapezoid: 0.5, baguette: 2.6, round: 1, oval: 0.74, pear: 1.5, none: 1 }[d.sides.kind];
    const hugL = L * d.sides.hugFrac;
    const fitted = d.sides.hug && canHug(d.sides.kind);
    const { L: sl, W: sw } = fitted
      ? d.sides.kind === "baguette" ? { L: W * 0.75, W: W * 0.3 } : d.sides.kind === "round" ? { L: hugL * 0.8, W: hugL * 0.8 } : d.sides.kind === "pear" ? { L: hugL * 0.9, W: hugL * 0.6 } : { L: hugL, W: hugL * asp }
      : sideStoneDims(d.sides.kind, d.sides.sizeCt);
    const { g, ol, cx, pav } = sideStoneGeo(d.sides.kind, sl, sw);
    const sc = (s: number) => ol.map(([x, z]) => new THREE.Vector2(cx + (x - cx) * s, z * s));
    const hug = fitted;
    const shape = new THREE.Shape(sc(1.035));
    shape.holes.push(new THREE.Path(sc(0.985).reverse()));
    const bz = new THREE.ExtrudeGeometry(shape, { depth: hug ? Math.min(0.7, pav * 0.25) : d.sides.kind === "round" || d.sides.kind === "oval" || d.sides.kind === "pear" ? Math.min(0.9, pav * 0.3) : Math.min(1.9, pav * 0.7), bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.08, bevelSegments: 3, curveSegments: 24 });
    bz.rotateX(Math.PI / 2); bz.translate(0, 0.18, 0); bz.computeVertexNormals();
    const edgeX = Math.max(...Array.from({ length: 180 }, (_, i) => fn(i / 180)[0]));
    const gap = (hug ? edgeX : W / 2) + (d.setting.style === "bezel" ? 0.62 : hug ? 0.04 : 0.18);
    if (hug) {
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
      const spanX = Math.max(...ol.map(([x]) => x)) || 1;
      const isCabC = c.cut === "cabochon";
      const bellyC = isCabC ? Math.min(W * 0.14, 2) : W * 0.43;
      const setIn = d.band.profile === "set-in" ? Math.max(2.9, bellyC * 0.75 + 0.6) - 0.3 : d.band.profile === "flush" ? Math.min(7, Math.max(2.6, bellyC + 0.7)) : 0;
      const pavF = 0.85, pavD = pav * pavF;
      const top = { topW: Math.max(d.band.widthMm + 0.8, sl * 0.88), topT: Math.max(2.4, pavD + 1.0, setIn), spread: gap + spanX * 1.05 };
      shankMesh.geometry.dispose();
      shankMesh.geometry = shankGeo(RIN, d.band.widthMm, d.band.finish, top, d.band.shape, d.band.split);
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
      const shallow = g.clone();
      { const pos = shallow.getAttribute("position") as THREE.BufferAttribute; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); if (y < 0) pos.setY(i, y * pavF); } pos.needsUpdate = true; shallow.computeVertexNormals(); }
      const seatShape = new THREE.Shape(sc(1.04));
      seatShape.holes.push(new THREE.Path(sc(0.985).reverse()));
      const seat = new THREE.ExtrudeGeometry(seatShape, { depth: pavD + 0.5, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.06, bevelSegments: 2, curveSegments: 24 });
      seat.rotateX(Math.PI / 2); seat.translate(0, 0.12, 0);
      const floorShape = new THREE.Shape(sc(1.0));
      const floor = new THREE.ExtrudeGeometry(floorShape, { depth: 0.4, bevelEnabled: false, curveSegments: 24 });
      floor.rotateX(Math.PI / 2); floor.translate(0, -pavD - 0.05, 0);
      const gb = bent(shallow), bzb = bent(seat), flb = bent(floor);
      for (const side of [1, -1]) {
        const grp = new THREE.Group();
        grp.userData.part = "sides";
        grp.userData.onBand = true;
        grp.add(new THREE.Mesh(gb, mirror), new THREE.Mesh(gb, diamond), new THREE.Mesh(bzb, metal), new THREE.Mesh(flb, metal));
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
      const clawSet = !hug && (d.sides.kind === "round" || d.sides.kind === "oval" || d.sides.kind === "pear");
      grp.add(new THREE.Mesh(g, mirror), new THREE.Mesh(g, diamond));
      if (!clawSet) grp.add(new THREE.Mesh(bz, metal));
      if (!clawSet && !hug) {
        const across = gap + 0.13 + cx;
        const bandY = Math.sqrt(Math.max(0, (RIN + 2.1) ** 2 - across * across));
        const drop = Math.max(1, GY - 0.05 - bandY + 0.6);
        const seat = new THREE.ExtrudeGeometry(new THREE.Shape(sc(0.9)), { depth: drop, bevelEnabled: true, bevelThickness: 0.15, bevelSize: 0.12, bevelSegments: 3, curveSegments: 24 });
        seat.rotateX(Math.PI / 2); seat.translate(0, -0.35, 0);
        const sp = seat.getAttribute("position") as THREE.BufferAttribute;
        for (let i = 0; i < sp.count; i++) {
          const t = Math.min(1, Math.max(0, -(sp.getY(i) + 0.35) / drop));
          const k = 1 - 0.68 * Math.sqrt(t);
          sp.setX(i, cx + (sp.getX(i) - cx) * k - t * Math.min(3, across * 0.28)); sp.setZ(i, sp.getZ(i) * (1 - 0.5 * Math.sqrt(t)));
        }
        sp.needsUpdate = true; seat.computeVertexNormals();
        grp.add(new THREE.Mesh(seat, metal));
      }
      else for (const f of [0.125, 0.375, 0.625, 0.875]) {
        const [x, z] = ol[Math.floor(f * ol.length) % ol.length];
        const out = new THREE.Vector3(cx + (x - cx) * 1.05, 0, z * 1.05);
        const claw = tube([new THREE.Vector3(cx + (x - cx) * 0.55, -pav * 0.85, z * 0.55), new THREE.Vector3(out.x, 0.02, out.z), new THREE.Vector3(cx + (x - cx) * 1.0, Math.max(0.25, pav * 0.3), z * 1.0)], 0.26);
        const tip = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 9), metal);
        tip.scale.set(1, 0.8, 1); tip.position.set(cx + (x - cx) * 1.0, Math.max(0.25, pav * 0.3), z * 1.0);
        grp.add(claw, tip);
      }
      for (const z of [-1, 1].map((k) => k * Math.min(1.6, sl * 0.22))) {
        grp.add(tube([new THREE.Vector3(cx + 0.3, -pav * 0.7, z), new THREE.Vector3(-0.3, -pav * 0.72, z * 0.9), new THREE.Vector3(-(gap - W * 0.35) + 0.3, lowRailY - GY, z * 0.8)], 0.42));
      }
      if (hug) {
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
