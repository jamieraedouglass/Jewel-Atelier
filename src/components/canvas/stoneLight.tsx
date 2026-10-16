import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { type Piece } from "@/lib/jewelryModel";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * Diamonds read as grey when their mirror facets reflect a dark studio. A real stone is lit by a bright room and
 * bounces light around inside, so the stone facets (and only those; metal keeps the dark light box) reflect a bright room.
 */
const roomEnvs = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
/** the bright room, rendered once per renderer: a texture drawn in one WebGL context is empty in any other */
function roomEnvFor(gl: THREE.WebGLRenderer) {
  let env = roomEnvs.get(gl);
  if (!env) {
    const pm = new THREE.PMREMGenerator(gl);
    // a bright room with a big softbox overhead, so stones seen from above (the Top view) light up instead of going grey
    const room = new RoomEnvironment();
    const box = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(6), side: THREE.DoubleSide }));
    box.rotation.x = Math.PI / 2; box.position.y = 9;
    room.add(box);
    env = pm.fromScene(room, 0.005).texture;
    pm.dispose();
    roomEnvs.set(gl, env);
  }
  return env;
}

/** point stone facets at the bright room (see StoneLight); used for the on-screen piece and for try-on copies */
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
