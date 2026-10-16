import STUDIO_HDR from "@/lib/hdri/studio";
import { useLoader, useThree } from "@react-three/fiber";
import { EnvironmentPortal, Lightformer } from "@react-three/drei";
import { EXRLoader } from "three/examples/jsm/loaders/EXRLoader.js";
import { useEffect } from "react";
import * as THREE from "three";

/** The jeweller's light box: dark room, crisp strip lights so facets flash and metal reads as polished. */
/** a real photographic studio (softboxes, a white sweep) for metal and stones to reflect */
export function useStudio() {
  const tex = useLoader(EXRLoader, STUDIO_HDR);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  return tex;
}

/** The jeweller's light box: a real studio HDR, plus crisp strip lights so facets flash and metal reads as polished. */
export function StudioLights() {
  const hdr = useStudio();
  const strips = Array.from({ length: 14 }, (_, k) => {
    const a = (k / 14) * Math.PI * 2, h = (k % 3) * 7 - 6, I = [8, 3.5, 5.5][k % 3];
    return <Lightformer key={k} form="rect" intensity={I} position={[Math.cos(a) * 27, h, Math.sin(a) * 27]} scale={[1.6, 9, 1]} target={[0, 0, 0]} />;
  });
  return (
    <EnvironmentPortal map={hdr} resolution={512} background={false} environmentIntensity={0.32}>
      <Lightformer form="rect" intensity={9} position={[0, 19, 0]} rotation-x={Math.PI / 2} scale={[22, 4, 1]} />
      <Lightformer form="rect" intensity={4} position={[-24, 4, 10]} scale={[3, 20, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={3.5} position={[24, 4, -6]} scale={[3, 20, 1]} target={[0, 0, 0]} />
      {strips}
    </EnvironmentPortal>
  );
}

/** a soft pool of light behind the piece, like a jeweller's velvet board under a lamp */
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
