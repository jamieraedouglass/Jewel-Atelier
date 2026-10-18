import STUDIO_HDR from "@/lib/hdri/studio";
import { useLoader, useThree } from "@react-three/fiber";
import { EnvironmentPortal, Lightformer } from "@react-three/drei";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { useEffect } from "react";
import * as THREE from "three";

export function useStudio() {
  const tex = useLoader(EXRLoader, STUDIO_HDR);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

export type Lighting = "studio" | "daylight" | "warm";
export const LIGHT_LOOK: Record<Lighting, { top: string; side: string; strip: string; key: number; strips: number; env: number; sun: string; sunI: number }> = {
  studio: { top: "#ffffff", side: "#ffffff", strip: "#ffffff", key: 1, strips: 1, env: 0.32, sun: "#fff4e6", sunI: 1.2 },
  daylight: { top: "#e6efff", side: "#ffffff", strip: "#dce8ff", key: 1.9, strips: 0.55, env: 0.42, sun: "#f4f8ff", sunI: 1.6 },
  warm: { top: "#ffd9ad", side: "#ffc98a", strip: "#ffdcb8", key: 0.9, strips: 0.8, env: 0.26, sun: "#ffcf96", sunI: 1.1 },
};

export function StudioLights({ lighting = "studio" }: { lighting?: Lighting }) {
  const hdr = useStudio();
  const L = LIGHT_LOOK[lighting];
  const strips = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2, h = (k % 3) * 7 - 6, I = [8, 3.5, 5.5][k % 3] * L.strips;
    return <Lightformer key={k} form="rect" color={L.strip} intensity={I} position={[Math.cos(a) * 27, h, Math.sin(a) * 27]} scale={[1.6, 9, 1]} target={[0, 0, 0]} />;
  });
  return (
    <EnvironmentPortal map={hdr} resolution={512} background={false} environmentIntensity={L.env}>
      <Lightformer form="rect" color={L.top} intensity={9} position={[0, 19, 0]} rotation-x={Math.PI / 2} scale={[22, 4, 1]} />
      <Lightformer form="rect" color={L.side} intensity={4 * L.key} position={[-24, 4, 10]} scale={[lighting === "daylight" ? 10 : 3, 20, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" color={L.side} intensity={3.5 * (lighting === "daylight" ? 0.4 : 1)} position={[24, 4, -6]} scale={[3, 20, 1]} target={[0, 0, 0]} />
      {strips}
    </EnvironmentPortal>
  );
}

let backdropTex: THREE.CanvasTexture | null = null;
export function Backdrop() {
  const { scene } = useThree();
  useEffect(() => {
    if (!backdropTex) {
      const c = document.createElement("canvas"); c.width = c.height = 512;
      const ctx = c.getContext("2d")!;
      const g = ctx.createRadialGradient(256, 230, 20, 256, 256, 380);
      g.addColorStop(0, "#3a332d"); g.addColorStop(0.55, "#211c18"); g.addColorStop(1, "#0d0b09");
      ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 512);
      backdropTex = new THREE.CanvasTexture(c);
      backdropTex.colorSpace = THREE.SRGBColorSpace;
    }
    const prev = scene.background;
    scene.background = backdropTex;
    return () => { scene.background = prev; };
  }, [scene]);
  return null;
}
