"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Design } from "@/lib/design";
import { buildPiece, type Piece } from "@/lib/jewelryModel";
import { disposeGroup } from "@/lib/ringModel";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshRefractionMaterial } from "@react-three/drei/materials/MeshRefractionMaterial";
import { MeshBVH, MeshBVHUniformStruct, SAH } from "three-mesh-bvh";

export type View = "hero" | "top" | "detail";
export const VIEW_LABEL: Record<View, string> = { hero: "¾", top: "Top", detail: "Detail" };
export type Cutout = { url: string; mmPerPx: number; widthMm: number; heightMm: number };
export type RingCanvasHandle = {
  snapshot: (type?: "image/jpeg" | "image/png") => Promise<Blob | null>;
  /** a true-to-scale picture of one piece (one earring of a pair) on a clear background, for trying it on a photo */
  cutout?: () => Cutout | null;
};
/** real size of the piece, mm: across, top to bottom, and how thick */
export type Measure = { widthMm: number; lengthMm: number; depthMm: number; what: string };

const FOV = 28;

/** Where the camera sits for each view, framed to the piece's size. */
function framing(piece: Piece, view: View) {
  const box = new THREE.Box3().setFromObject(piece.group);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const fit = (r: number) => (r / Math.sin(THREE.MathUtils.degToRad(FOV / 2))) * 1.25;
  if (piece.upright) {
    // rings stand up, so look at them like a product shot
    const t = sphere.center.clone().add(new THREE.Vector3(0, sphere.radius * 0.18, 0));
    if (view === "top") return { pos: t.clone().add(new THREE.Vector3(0.01, fit(sphere.radius) * 1.05, 6)), target: piece.focus.clone() };
    if (view === "detail") return { pos: t.clone().add(new THREE.Vector3(4, 10, fit(sphere.radius) * 1.05)), target: t };
    return { pos: t.clone().add(new THREE.Vector3(0.36, 0.52, 0.95).normalize().multiplyScalar(fit(sphere.radius) * 1.05)), target: t };
  }
  if (view === "top") return { pos: sphere.center.clone().add(new THREE.Vector3(0, fit(sphere.radius), 0.01)), target: sphere.center.clone() };
  if (view === "detail") {
    const r = Math.max(4, piece.focusSize / 2);
    return { pos: piece.focus.clone().add(new THREE.Vector3(0.25, 0.85, 0.75).normalize().multiplyScalar(fit(r))), target: piece.focus.clone() };
  }
  return { pos: sphere.center.clone().add(new THREE.Vector3(0.1, 0.8, 0.62).normalize().multiplyScalar(fit(sphere.radius))), target: sphere.center.clone() };
}

export type Part = "center" | "accents" | "sides" | "metal" | "fringe" | "extra" | "motif" | "drop";
export type Pick = { part: Part; x: number; y: number; index?: number };

/** the part worth measuring: one earring of a pair, a ring's head, otherwise the whole piece */
function subjectOf(piece: Piece, design: Design): { obj: THREE.Object3D; hide: THREE.Object3D[]; what: string } {
  const g = piece.group;
  if (design.type === "earrings" && g.children.length >= 2) return { obj: g.children[0], hide: g.children.slice(1), what: "each earring" };
  return { obj: g, hide: [], what: design.type === "ring" ? "the ring" : "the piece" };
}

export function measurePiece(piece: Piece, design: Design): Measure {
  const { obj, what } = subjectOf(piece, design);
  obj.updateWorldMatrix(true, true);
  const b = new THREE.Box3();
  if (design.type === "ring") {
    // a ring's top: the stones and what holds them, not the band
    obj.traverse((o) => { if (["center", "sides", "extra", "accents", "motif"].includes(o.userData.part)) b.expandByObject(o); });
  }
  if (b.isEmpty()) b.setFromObject(obj);
  const sz = b.getSize(new THREE.Vector3());
  const r1 = (n: number) => Math.round(n * 10) / 10;
  if (design.type === "ring") return { widthMm: r1(sz.x), lengthMm: r1(sz.z), depthMm: r1(sz.y), what: "the ring's top" };
  if (piece.upright) return { widthMm: r1(sz.x), lengthMm: r1(sz.y), depthMm: r1(sz.z), what };
  return { widthMm: r1(sz.x), lengthMm: r1(sz.z), depthMm: r1(sz.y), what };
}

/** Lets the outside ask for a true-to-scale cutout: one frame drawn with a flat (orthographic) camera on a clear background. */
function Grabber({ piece, design, handle }: { piece: Piece; design: Design; handle?: React.MutableRefObject<RingCanvasHandle | null> }) {
  const { gl, scene } = useThree();
  const latest = useRef({ piece, design });
  latest.current = { piece, design };
  useEffect(() => {
    if (!handle?.current) return;
    handle.current.cutout = () => {
      const { piece, design } = latest.current;
      const { obj, hide } = subjectOf(piece, design);
      piece.group.updateWorldMatrix(true, true);
      hide.forEach((h) => (h.visible = false));
      const box = new THREE.Box3().setFromObject(obj);
      hide.forEach((h) => (h.visible = true));
      if (box.isEmpty()) return null;
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      // looking down on flat pieces (and rings, stone up); upright hoops are seen from the front
      const front = piece.upright && design.type !== "ring";
      const spanX = size.x, spanY = front ? size.y : size.z, depth = front ? size.z : size.y;
      const el = gl.domElement, cw = el.width, ch = el.height;
      const pad = 1.08, aspect = cw / ch;
      let fw = spanX * pad, fh = spanY * pad;
      if (fw / fh > aspect) fh = fw / aspect; else fw = fh * aspect;
      const cam = new THREE.OrthographicCamera(-fw / 2, fw / 2, fh / 2, -fh / 2, 0.1, depth * 4 + 200);
      if (front) { cam.position.set(c.x, c.y, c.z + depth + 100); cam.up.set(0, 1, 0); }
      else { cam.position.set(c.x, c.y + depth + 100, c.z); cam.up.set(0, 0, -1); }
      cam.lookAt(c);
      cam.updateProjectionMatrix();
      // hide everything but the piece (shadow, floor) and the background for this one frame
      const hidden: THREE.Object3D[] = [];
      scene.children.forEach((o) => { if (o !== piece.group && o.visible && !(o as THREE.Light).isLight) { o.visible = false; hidden.push(o); } });
      hide.forEach((h) => { h.visible = false; hidden.push(h); });
      const bg = scene.background, clear = gl.getClearAlpha();
      scene.background = null; gl.setClearAlpha(0);
      gl.render(scene, cam);
      const mmPerPx = fw / cw;
      const wPx = Math.ceil(spanX / mmPerPx), hPx = Math.ceil(spanY / mmPerPx);
      const out = document.createElement("canvas");
      out.width = wPx; out.height = hPx;
      out.getContext("2d")!.drawImage(el, (cw - wPx) / 2, (ch - hPx) / 2, wPx, hPx, 0, 0, wPx, hPx);
      scene.background = bg; gl.setClearAlpha(clear);
      hidden.forEach((o) => (o.visible = true));
      return { url: out.toDataURL("image/png"), mmPerPx, widthMm: spanX, heightMm: spanY };
    };
  }, [gl, scene, handle]);
  return null;
}

/**
 * Diamonds read as grey when their mirror facets reflect a dark studio. A real stone is lit by a bright room and
 * bounces light around inside, so the stone facets (and only those; metal keeps the dark light box) reflect a bright room.
 */
let roomEnv: THREE.Texture | null = null;
function StoneLight({ piece }: { piece: Piece }) {
  const { gl } = useThree();
  useEffect(() => {
    if (!roomEnv) {
      const pm = new THREE.PMREMGenerator(gl);
      roomEnv = pm.fromScene(new RoomEnvironment(), 0.005).texture;
      pm.dispose();
    }
    piece.group.traverse((o) => {
      const mats = (o as THREE.Mesh).material;
      if (!mats) return;
      for (const mat of Array.isArray(mats) ? mats : [mats]) {
        const ph = mat as THREE.MeshPhysicalMaterial;
        // only the mirror facets of stones (flat-shaded, metallic); coloured stone bodies and metal keep the studio light
        if (!ph.flatShading || ph.metalness < 0.9 || ph.userData.roomLit) continue;
        ph.envMap = roomEnv;
        ph.envMapIntensity = 1.35;
        ph.emissiveIntensity = Math.min(ph.emissiveIntensity ?? 0, 0.05);
        ph.userData.roomLit = true;
        ph.needsUpdate = true;
      }
    });
  }, [gl, piece]);
  return null;
}

/**
 * Real diamond optics for the individually set stones: light is traced through the actual facets (bouncing inside,
 * with a little fire), instead of the faster mirror-and-glass look. Small pavé stones are instanced and keep the fast look.
 */
let studioCube: THREE.CubeTexture | null = null;
const bvhCache = new Map<string, MeshBVHUniformStruct>();
type RefractMat = THREE.ShaderMaterial & { bvh: MeshBVHUniformStruct; envMap: THREE.Texture; color: THREE.Color; resolution: THREE.Vector2; viewMatrixInverse: THREE.Matrix4; projectionMatrixInverse: THREE.Matrix4; bounces: number; ior: number; aberrationStrength: number; fresnel: number };
function Refraction({ piece, enabled }: { piece: Piece; enabled: boolean }) {
  const { gl, size } = useThree();
  const mats = useRef<RefractMat[]>([]);
  useEffect(() => {
    if (!enabled) return;
    if (!studioCube) {
      const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
      const cam = new THREE.CubeCamera(0.1, 100, rt);
      cam.update(gl, new RoomEnvironment());
      studioCube = rt.texture as unknown as THREE.CubeTexture;
    }
    const made: RefractMat[] = [];
    const swaps: { mesh: THREE.Mesh; before: THREE.Material | THREE.Material[]; hidden: THREE.Object3D[] }[] = [];
    piece.group.updateWorldMatrix(true, true);
    piece.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return;
      const mirror = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mirror.flatShading || mirror.metalness < 0.9 || !mesh.parent) return;
      // the stone body drawn on top of the mirror shares its geometry: use its colour, then hide it
      const twin = mesh.parent.children.find((c) => c !== mesh && (c as THREE.Mesh).geometry === mesh.geometry) as THREE.Mesh | undefined;
      const body = twin?.material as THREE.MeshPhysicalMaterial | undefined;
      const colorless = !body || body.opacity < 0.5;
      const tint = colorless ? new THREE.Color(1, 1, 1) : body!.color.clone().lerp(new THREE.Color(1, 1, 1), 0.08);
      const key = mesh.geometry.uuid;
      let bvh = bvhCache.get(key);
      if (!bvh) {
        bvh = new MeshBVHUniformStruct();
        bvh.updateFrom(new MeshBVH(mesh.geometry.index ? mesh.geometry.clone().toNonIndexed() : mesh.geometry.clone(), { strategy: SAH }));
        bvhCache.set(key, bvh);
      }
      const mat = new (MeshRefractionMaterial as unknown as new () => RefractMat)();
      mat.defines = { CUBEUV_TEXEL_WIDTH: `${1 / 768}`, CUBEUV_TEXEL_HEIGHT: `${1 / 1024}`, CUBEUV_MAX_MIP: "8.0", ENVMAP_TYPE_CUBEM: "", CHROMATIC_ABERRATIONS: "", FAST_CHROMA: "" };
      mat.envMap = studioCube!;
      mat.bvh = bvh;
      mat.color = tint;
      mat.bounces = colorless ? 3 : 2;
      mat.ior = colorless ? 2.42 : 1.72;
      mat.aberrationStrength = colorless ? 0.012 : 0.004;
      mat.fresnel = 1;
      mat.resolution = new THREE.Vector2(size.width, size.height);
      made.push(mat);
      swaps.push({ mesh, before: mesh.material, hidden: twin ? [twin] : [] });
      mesh.material = mat;
      if (twin) twin.visible = false;
    });
    mats.current = made;
    return () => {
      swaps.forEach(({ mesh, before, hidden }) => { mesh.material = before; hidden.forEach((h) => (h.visible = true)); });
      made.forEach((m) => m.dispose());
      mats.current = [];
    };
  }, [piece, gl, enabled, size.width, size.height]);
  useFrame(({ camera }) => {
    for (const m of mats.current) { m.viewMatrixInverse = camera.matrixWorld; m.projectionMatrixInverse = camera.projectionMatrixInverse; }
  });
  return null;
}

function Model({ piece }: { piece: Piece }) {
  useEffect(() => () => disposeGroup(piece.group), [piece]);
  return <primitive object={piece.group} />;
}

/** Turns a click (not a drag) on the canvas into "which part of the piece was hit", using our own raycast. */
function ClickPicker({ piece, onPick, onMiss }: { piece: Piece; onPick?: (p: Pick) => void; onMiss?: () => void }) {
  const { camera, gl } = useThree();
  const latest = useRef({ piece, onPick, onMiss });
  latest.current = { piece, onPick, onMiss };
  useEffect(() => {
    const el = gl.domElement;
    let down: { x: number; y: number } | null = null;
    const ray = new THREE.Raycaster();
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; };
    const onUp = (e: PointerEvent) => {
      const { piece, onPick, onMiss } = latest.current;
      if (!down || !onPick) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = null;
      if (moved > 5) return; // that was a drag to turn the piece
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      piece.group.updateWorldMatrix(true, true);
      const hit = ray.intersectObject(piece.group, true)[0];
      if (!hit) { onMiss?.(); return; }
      let o: THREE.Object3D | null = hit.object;
      let index: number | undefined;
      while (o && !o.userData.part) o = o.parent;
      // inside a drop part, the part number lives on the part's group
      for (let q: THREE.Object3D | null = o; q; q = q.parent) if (typeof q.userData.dropIndex === "number") { index = q.userData.dropIndex; break; }
      onPick({ part: index !== undefined ? "drop" : ((o?.userData.part as Part) ?? "metal"), index, x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); };
  }, [camera, gl]);
  return null;
}

/** Re-frames when the view or the kind of piece changes, not on every slider tweak. */
function CameraRig({ view, piece, frameKey, controls }: { view: View; piece: Piece; frameKey: string; controls: React.RefObject<OrbitControlsImpl> }) {
  const { camera } = useThree();
  const latest = useRef(piece);
  latest.current = piece;
  useEffect(() => {
    const { pos: toP, target: toT } = framing(latest.current, view);
    const ctl = controls.current;
    const fromP = camera.position.clone(), fromT = ctl ? ctl.target.clone() : new THREE.Vector3();
    const dist = toP.distanceTo(toT);
    if (ctl) { ctl.minDistance = Math.max(4, dist * 0.15); ctl.maxDistance = dist * 3; }
    (camera as THREE.PerspectiveCamera).far = dist * 10;
    camera.updateProjectionMatrix();
    let t = 0, raf = 0;
    const step = () => {
      t = Math.min(1, t + 0.04);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(fromP, toP, e);
      ctl?.target.lerpVectors(fromT, toT, e);
      ctl?.update();
      if (t < 1) raf = requestAnimationFrame(step);
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [view, frameKey, camera, controls]);
  return null;
}

/** The jeweller's light box: dark room, crisp strip lights so facets flash and metal reads as polished. */
function StudioLights() {
  const strips = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2, h = (k % 3) * 7 - 6, I = [9, 4, 6.5][k % 3];
    return <Lightformer key={k} form="rect" intensity={I} position={[Math.cos(a) * 27, h, Math.sin(a) * 27]} scale={[2.2, 9, 1]} target={[0, 0, 0]} />;
  });
  return (
    <Environment resolution={256} background={false}>
      <color attach="background" args={["#141418"]} />
      <Lightformer form="rect" intensity={11} position={[0, 19, 0]} rotation-x={Math.PI / 2} scale={[26, 5, 1]} />
      <Lightformer form="rect" intensity={7} position={[-24, 4, 10]} scale={[4, 22, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={6} position={[24, 4, -6]} scale={[4, 22, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={4.5} color="#fff3e6" position={[0, 8, 26]} scale={[18, 3, 1]} target={[0, 0, 0]} />
      {strips}
    </Environment>
  );
}

/** `handle` is a plain prop, not a ref: next/dynamic does not forward refs, so a ref would silently stay null. */
type Props = {
  design: Design; view?: View; autoRotate?: boolean; className?: string; handle?: React.MutableRefObject<RingCanvasHandle | null>;
  onPick?: (p: Pick) => void; onMiss?: () => void; onMeasure?: (m: Measure) => void;
  /** fast rendering for small previews */
  lite?: boolean;
};

export default function RingCanvas({ design, view = "hero", autoRotate = true, className, handle, onPick, onMiss, onMeasure, lite }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const piece = useMemo(() => buildPiece(design), [design]);
  const floor = useMemo(() => {
    const box = new THREE.Box3().setFromObject(piece.group);
    return { y: box.min.y - 0.05, scale: Math.max(40, (box.max.x - box.min.x) * 1.6, (box.max.z - box.min.z) * 1.6) };
  }, [piece]);
  const measureCb = useRef(onMeasure);
  measureCb.current = onMeasure;
  useEffect(() => { measureCb.current?.(measurePiece(piece, design)); }, [piece, design]);
  useEffect(() => {
    if (!handle) return;
    handle.current = {
      snapshot: (type = "image/jpeg") => new Promise((res) => (canvasEl.current ? canvasEl.current.toBlob((b) => res(b), type, 0.9) : res(null))),
    };
    return () => { handle.current = null; };
  }, [handle]);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  // gallery thumbnails and very small views keep the fast stone look
  const lowPower = !!lite;
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [20, 30, 52], near: 0.2, far: 5000 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      onCreated={({ gl }) => { canvasEl.current = gl.domElement; }}
    >
      <color attach="background" args={["#17130f"]} />
      <StudioLights />
      <directionalLight position={[10, 30, 20]} intensity={1.2} color="#fff4e6" />
      <Model piece={piece} />
      <StoneLight piece={piece} />
      <Refraction piece={piece} enabled={!lowPower} />
      <ClickPicker piece={piece} onPick={onPick} onMiss={onMiss} />
      <Grabber piece={piece} design={design} handle={handle} />
      <ContactShadows position={[0, floor.y, 0]} opacity={0.55} scale={floor.scale} blur={2.6} far={piece.upright ? 14 : 8} resolution={1024} />
      <OrbitControls ref={controls} makeDefault enableDamping enablePan={false} autoRotate={autoRotate && !reduce} autoRotateSpeed={0.7} />
      <CameraRig view={view} piece={piece} frameKey={`${design.type}:${design.style}:${design.drop.parts.map((x) => x.kind[0] + Math.round(x.stone.lengthMm / 4)).join("")}:${design.options.hoopShape}`} controls={controls} />
    </Canvas>
  );
}
