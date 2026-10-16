"use client";

import type { Design } from "@/lib/design";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, OrbitControls } from "@react-three/drei";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { buildPiece } from "@/lib/jewelryModel";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { type Measure, type Pick, type RingCanvasHandle, type View } from "./canvas/types";
import { FOV, measurePiece } from "./canvas/framing";
import { Grabber } from "./canvas/Grabber";
import { StoneLight, forgetRoomEnv } from "./canvas/stoneLight";
import { Refraction, forgetStudioCube } from "./canvas/Refraction";
import { CameraRig, ClickPicker, Model } from "./canvas/sceneParts";
import { Backdrop, StudioLights } from "./canvas/studio";

/** `handle` is a plain prop, not a ref: next/dynamic does not forward refs, so a ref would silently stay null. */
type Props = {
  design: Design; view?: View; autoRotate?: boolean; className?: string; handle?: React.MutableRefObject<RingCanvasHandle | null>;
  onPick?: (p: Pick) => void; onMiss?: () => void; onMeasure?: (m: Measure) => void;
  /** fast rendering for small previews */
  lite?: boolean;
  /** "high": ray-traced diamonds and the finishing pass; "standard": the faster look */
  quality?: "high" | "standard";
};

export default function RingCanvas({ design, view = "hero", autoRotate = true, className, handle, onPick, onMiss, onMeasure, lite, quality = "high" }: Props) {
  const controls = useRef<OrbitControlsImpl>(null);
  const canvasEl = useRef<HTMLCanvasElement | null>(null);
  // bumped when the browser restores a lost 3D context: the piece is rebuilt so every stone gets fresh lighting
  const [restored, setRestored] = useState(0);
  const piece = useMemo(() => buildPiece(design), [design, restored]); // eslint-disable-line react-hooks/exhaustive-deps
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
  // gallery thumbnails and very small views keep the fast stone look; "standard" quality (chosen by the viewer) does too
  const lowPower = !!lite || quality === "standard";
  return (
    <Canvas
      className={className}
      dpr={[1, 2]}
      camera={{ fov: FOV, position: [20, 30, 52], near: 0.2, far: 5000 }}
      gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, toneMapping: THREE.NeutralToneMapping, toneMappingExposure: 1.0 }}
      onCreated={({ gl }) => {
        canvasEl.current = gl.domElement;
        // a lost and restored context (GPU switch, sleep) leaves the rendered light maps empty: stones would go black
        gl.domElement.addEventListener("webglcontextrestored", () => { forgetRoomEnv(gl); forgetStudioCube(gl); setRestored((n) => n + 1); });
      }}
    >
      <Backdrop />
      <Suspense fallback={null}><StudioLights /></Suspense>
      <directionalLight position={[10, 30, 20]} intensity={1.2} color="#fff4e6" />
      <Model piece={piece} />
      <StoneLight piece={piece} />
      <Suspense fallback={null}><Refraction piece={piece} enabled={!lowPower} /></Suspense>
      <ClickPicker piece={piece} onPick={onPick} onMiss={onMiss} />
      <Grabber piece={piece} design={design} handle={handle} />
      <ContactShadows position={[0, floor.y, 0]} opacity={0.55} scale={floor.scale} blur={2.6} far={piece.upright ? 14 : 8} resolution={1024} />
      <OrbitControls ref={controls} makeDefault enableDamping enablePan={false} autoRotate={autoRotate && !reduce} autoRotateSpeed={0.7} />
      {!lowPower && (
        // the finishing pass: soft contact shading where stones meet metal, a little glow on the brightest facet
        // flashes (the sparkle you see in person), anti-aliasing, then the same neutral tone mapping as before
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO halfRes aoRadius={2.2} intensity={1.6} distanceFalloff={0.6} color="#000000" quality="medium" />
          <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.1} intensity={0.35} radius={0.5} />
          <ToneMapping mode={ToneMappingMode.NEUTRAL} />
          <SMAA />
        </EffectComposer>
      )}
      <CameraRig view={view} piece={piece} frameKey={`${design.type}:${design.style}:${design.drop.parts.map((x) => x.kind[0] + Math.round(x.stone.lengthMm / 4)).join("")}:${design.options.hoopShape}`} controls={controls} />
    </Canvas>
  );
}
