import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { type Piece } from "@/lib/jewelryModel";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { addLightTent } from "./lightTent";

const roomEnvs = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
export const forgetRoomEnv = (gl: THREE.WebGLRenderer) => roomEnvs.delete(gl);
function roomEnvFor(gl: THREE.WebGLRenderer) {
  let env = roomEnvs.get(gl);
  if (!env) {
    const pm = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    addLightTent(room, 6);
    env = pm.fromScene(room, 0.005).texture;
    pm.dispose();
    roomEnvs.set(gl, env);
  }
  return env;
}

export function roomLight(gl: THREE.WebGLRenderer, group: THREE.Object3D) {
  const roomEnv = roomEnvFor(gl);
  group.traverse((o) => {
    const mats = (o as THREE.Mesh).material;
    if (!mats) return;
    for (const mat of Array.isArray(mats) ? mats : [mats]) {
      const ph = mat as THREE.MeshPhysicalMaterial;
      if (!ph.flatShading || ph.userData.roomLit) continue;
      if (ph.metalness < 0.9) { ph.envMap = roomEnv; ph.envMapIntensity = 1; ph.userData.roomLit = true; ph.needsUpdate = true; continue; }
      ph.envMap = roomEnv;
      ph.envMapIntensity = 1.35;
      ph.emissiveIntensity = Math.min(ph.emissiveIntensity ?? 0, 0.05);
      ph.userData.roomLit = true;
      ph.needsUpdate = true;
    }
  });
}

export function StoneLight({ piece }: { piece: Piece }) {
  const { gl } = useThree();
  useEffect(() => {
    roomLight(gl, piece.group);
  }, [gl, piece]);
  return null;
}

