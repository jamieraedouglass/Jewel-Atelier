"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type { Design } from "@/lib/design";
import { buildPiece, type Piece } from "@/lib/jewelryModel";
import { disposeGroup } from "@/lib/ringModel";

export type View = "hero" | "top" | "detail";
export const VIEW_LABEL: Record<View, string> = { hero: "¾", top: "Top", detail: "Detail" };
export type RingCanvasHandle = { snapshot: (type?: "image/jpeg" | "image/png") => Promise<Blob | null> };

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

export type Part = "center" | "accents" | "sides" | "metal" | "fringe" | "extra" | "motif";
export type Pick = { part: Part; x: number; y: number };

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
      while (o && !o.userData.part) o = o.parent;
      onPick({ part: (o?.userData.part as Part) ?? "metal", x: e.clientX - r.left, y: e.clientY - r.top });
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
type Props = { design: Design; view?: View; autoRotate?: boolean; className?: string; handle?: React.MutableRefObject<RingCanvasHandle | null>; onPick?: (p: Pick) => void; onMiss?: () => void };

export default function RingCanvas({ design, view = "hero", autoRotate = true, className, handle, onPick, onMiss }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  const piece = useMemo(() => buildPiece(design), [design]);
  const floor = useMemo(() => {
    const box = new THREE.Box3().setFromObject(piece.group);
    return { y: box.min.y - 0.05, scale: Math.max(40, (box.max.x - box.min.x) * 1.6, (box.max.z - box.min.z) * 1.6) };
  }, [piece]);
  useEffect(() => {
    if (!handle) return;
    handle.current = {
      snapshot: (type = "image/jpeg") => new Promise((res) => (canvasEl.current ? canvasEl.current.toBlob((b) => res(b), type, 0.9) : res(null))),
    };
    return () => { handle.current = null; };
  }, [handle]);
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [20, 30, 52], near: 0.2, far: 5000 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => { canvasEl.current = gl.domElement; }}
    >
      <color attach="background" args={["#17130f"]} />
      <StudioLights />
      <directionalLight position={[10, 30, 20]} intensity={1.2} color="#fff4e6" />
      <Model piece={piece} />
      <ClickPicker piece={piece} onPick={onPick} onMiss={onMiss} />
      <ContactShadows position={[0, floor.y, 0]} opacity={0.55} scale={floor.scale} blur={2.6} far={piece.upright ? 14 : 8} resolution={1024} />
      <OrbitControls ref={controls} makeDefault enableDamping enablePan={false} autoRotate={autoRotate && !reduce} autoRotateSpeed={0.7} />
      <CameraRig view={view} piece={piece} frameKey={`${design.type}:${design.style}`} controls={controls} />
    </Canvas>
  );
}
