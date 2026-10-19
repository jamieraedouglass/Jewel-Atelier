import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { type Piece } from "@/lib/jewelryModel";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { MeshRefractionMaterial } from "@react-three/drei/materials/MeshRefractionMaterial";
import { MeshBVH, MeshBVHUniformStruct, SAH } from "three-mesh-bvh";
import { useStudio } from "./studio";
import { glowTint } from "@/lib/glow";
import { addLightTent } from "./lightTent";

const studioCubes = new WeakMap<THREE.WebGLRenderer, THREE.CubeTexture>();
export const forgetStudioCube = (gl: THREE.WebGLRenderer) => studioCubes.delete(gl);
function studioCubeFor(gl: THREE.WebGLRenderer) {
  let cube = studioCubes.get(gl);
  if (!cube) {
    const rt = new THREE.WebGLCubeRenderTarget(512, { type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, colorSpace: THREE.SRGBColorSpace });
    const cam = new THREE.CubeCamera(0.1, 100, rt);
    const env = new RoomEnvironment();
    addLightTent(env, 4);
    cam.update(gl, env);
    cube = rt.texture as unknown as THREE.CubeTexture;
    studioCubes.set(gl, cube);
  }
  return cube;
}

const bvhs = new Map<string, { bvh: MeshBVHUniformStruct; users: number }>();
function acquireBvh(geometry: THREE.BufferGeometry) {
  let e = bvhs.get(geometry.uuid);
  if (!e) {
    const bvh = new MeshBVHUniformStruct();
    bvh.updateFrom(new MeshBVH(geometry.index ? geometry.clone().toNonIndexed() : geometry.clone(), { strategy: SAH }));
    e = { bvh, users: 0 };
    bvhs.set(geometry.uuid, e);
  }
  e.users++;
  return e.bvh;
}
function releaseBvh(key: string) {
  const e = bvhs.get(key);
  if (!e) return;
  e.users--;
  setTimeout(() => {
    if (e.users > 0 || bvhs.get(key) !== e) return;
    e.bvh.dispose();
    bvhs.delete(key);
  }, 0);
}

type RefractMat = THREE.ShaderMaterial & { correctMips: boolean; bvh: MeshBVHUniformStruct; envMap: THREE.Texture; color: THREE.Color; resolution: THREE.Vector2; viewMatrixInverse: THREE.Matrix4; projectionMatrixInverse: THREE.Matrix4; bounces: number; ior: number; aberrationStrength: number; fresnel: number };
export function Refraction({ piece, enabled }: { piece: Piece; enabled: boolean }) {
  const { gl, size } = useThree();
  const hdr = useStudio();
  const mats = useRef<RefractMat[]>([]);
  useEffect(() => {
    if (!enabled) return;
    const studioCube = studioCubeFor(gl);
    const made: RefractMat[] = [];
    const swaps: { mesh: THREE.Mesh; before: THREE.Material | THREE.Material[]; hidden: THREE.Object3D[] }[] = [];
    const bvhKeys: string[] = [];
    let instCount = 0;
    piece.group.updateWorldMatrix(true, true);
    piece.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material)) return;
      const inst = (mesh as THREE.InstancedMesh).isInstancedMesh;
      if (inst && (instCount += (mesh as THREE.InstancedMesh).count) > 1600) return;
      const mirror = mesh.material as THREE.MeshPhysicalMaterial;
      if (!mirror.flatShading || mirror.metalness < 0.9 || !mesh.parent) return;
      const twin = mesh.parent.children.find((c) => c !== mesh && (c as THREE.Mesh).geometry === mesh.geometry) as THREE.Mesh | undefined;
      const body = twin?.material as THREE.MeshPhysicalMaterial | undefined;
      const colorless = !body || body.opacity < 0.5;
      const tint = colorless ? new THREE.Color(mesh.userData.tint ?? 0xffffff) : glowTint(body!.color.clone().lerp(new THREE.Color(1, 1, 1), 0.08), body!.userData.glow ?? 0);
      const bvh = acquireBvh(mesh.geometry);
      bvhKeys.push(mesh.geometry.uuid);
      const mat = new (MeshRefractionMaterial as unknown as new () => RefractMat)();
      mat.defines = { CUBEUV_TEXEL_WIDTH: `${1 / 768}`, CUBEUV_TEXEL_HEIGHT: `${1 / 1024}`, CUBEUV_MAX_MIP: "8.0", ENVMAP_TYPE_CUBEM: "", CHROMATIC_ABERRATIONS: "", FAST_CHROMA: "" };
      mat.envMap = studioCube;
      mat.bvh = bvh;
      mat.color = tint;
      const shallow = !!mesh.userData.shallow;
      mat.bounces = shallow ? 1 : inst ? 2 : colorless ? 3 : 2;
      mat.ior = shallow ? 1.9 : colorless ? 2.42 : 1.72;
      mat.aberrationStrength = colorless ? 0.022 : 0.006;
      mat.fresnel = 1;
      mat.resolution = new THREE.Vector2(size.width * gl.getPixelRatio(), size.height * gl.getPixelRatio());
      mat.correctMips = false;
      mat.fragmentShader = mat.fragmentShader.replace(
        "gl_FragColor = vec4(mix(diffuseColor.rgb, vec3(1.0), nFresnel), diffuseColor.a);",
        "vec3 outC = mix(diffuseColor.rgb, vec3(1.0), nFresnel); if (any(isnan(outC)) || any(isinf(outC))) outC = color * 0.85; gl_FragColor = vec4(clamp(outC, 0.0, 4.0), diffuseColor.a);",
      );
      mat.depthWrite = (mesh.material as THREE.Material).depthWrite;
      made.push(mat);
      swaps.push({ mesh, before: mesh.material, hidden: twin ? [twin] : [] });
      mesh.material = mat;
      if (twin) twin.visible = false;
    });
    mats.current = made;
    return () => {
      swaps.forEach(({ mesh, before, hidden }) => { mesh.material = before; hidden.forEach((h) => (h.visible = true)); });
      made.forEach((m) => m.dispose());
      bvhKeys.forEach(releaseBvh);
      mats.current = [];
    };
  }, [piece, gl, enabled, size.width, size.height, hdr]);
  useFrame(({ camera }) => {
    for (const m of mats.current) { m.viewMatrixInverse = camera.matrixWorld; m.projectionMatrixInverse = camera.projectionMatrixInverse; }
  });
  return null;
}
