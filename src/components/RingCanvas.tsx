"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer, OrbitControls } from "@react-three/drei";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { type Design, ringInnerDiameter } from "@/lib/design";
import { buildRing, disposeGroup } from "@/lib/ringModel";

export type View = "hero" | "top" | "profile";
export type RingCanvasHandle = { snapshot: () => Promise<Blob | null> };

const VIEWS: Record<View, { pos: [number, number, number]; target: [number, number, number] }> = {
  hero: { pos: [20, 30, 52], target: [0, 5.5, 0] },
  top: { pos: [0.01, 74, 6], target: [0, 12, 0] },
  profile: { pos: [4, 18, 70], target: [0, 7, 0] },
};

function RingModel({ design }: { design: Design }) {
  const group = useMemo(() => buildRing(design), [design]);
  useEffect(() => () => disposeGroup(group), [group]);
  return <primitive object={group} />;
}

function CameraRig({ view, controls }: { view: View; controls: React.RefObject<OrbitControlsImpl> }) {
  const { camera } = useThree();
  useEffect(() => {
    const v = VIEWS[view];
    const fromP = camera.position.clone();
    const ctl = controls.current;
    const fromT = ctl ? ctl.target.clone() : new THREE.Vector3();
    const toP = new THREE.Vector3(...v.pos), toT = new THREE.Vector3(...v.target);
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
  }, [view, camera, controls]);
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

type Props = { design: Design; view?: View; autoRotate?: boolean; className?: string };

const RingCanvas = forwardRef<RingCanvasHandle, Props>(function RingCanvas({ design, view = "hero", autoRotate = true, className }, ref) {
  const controls = useRef<OrbitControlsImpl>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  useImperativeHandle(ref, () => ({
    snapshot: () => new Promise((res) => (canvasEl.current ? canvasEl.current.toBlob((b) => res(b), "image/jpeg", 0.88) : res(null))),
  }));
  const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const RIN = ringInnerDiameter(design.ringSize) / 2;
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ fov: 28, position: VIEWS.hero.pos, near: 0.5, far: 500 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onCreated={({ gl }) => (canvasEl.current = gl.domElement)}
    >
      <color attach="background" args={["#17130f"]} />
      <StudioLights />
      <directionalLight position={[10, 30, 20]} intensity={1.2} color="#fff4e6" />
      <RingModel design={design} />
      <ContactShadows position={[0, -(RIN + 2), 0]} opacity={0.55} scale={40} blur={2.6} far={14} />
      <OrbitControls ref={controls} makeDefault enableDamping enablePan={false} minDistance={24} maxDistance={120} autoRotate={autoRotate && !reduce} autoRotateSpeed={0.9} target={VIEWS.hero.target} />
      <CameraRig view={view} controls={controls} />
    </Canvas>
  );
});

export default RingCanvas;
