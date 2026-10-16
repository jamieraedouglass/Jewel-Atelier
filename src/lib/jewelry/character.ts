import * as THREE from "three";
import type { CenterStone } from "../design";
import type { OutlineFn } from "../ringModel";

/**
 * What makes a stone itself, drawn on top of the stone: a star sapphire's star (or a cat's eye's band), which slides
 * across the dome as the piece turns, the way a real one follows the light; and inclusions, small crystals and
 * feathers inside the stone.
 */

const STAR_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const STAR_FRAG = /* glsl */ `
  uniform vec2 halfSize;
  uniform vec2 offset;
  uniform float lines;
  uniform float strength;
  uniform vec3 tint;
  varying vec3 vPos;
  void main() {
    if (vPos.y < 0.0) discard;
    vec2 p = vec2(vPos.x / halfSize.x, vPos.z / halfSize.y) - offset;
    float r = length(p);
    float rays = 0.0;
    for (int i = 0; i < 6; i++) {
      if (float(i) >= lines) break;
      float th = 1.5707963 + 3.1415926 * float(i) / lines;
      float d = abs(cos(th) * p.y - sin(th) * p.x);
      rays += exp(-pow(d / (0.036 + r * 0.035), 2.0));
    }
    float core = exp(-pow(r / 0.1, 2.0));
    float v = (rays * 0.75 + core) * smoothstep(1.1, 0.15, r) * strength;
    gl_FragColor = vec4(tint * v, v);
  }
`;

/**
 * The star (or band) as a thin layer over a cabochon's dome. `geo` is the stone's own geometry; the layer moves its
 * centre against the viewing direction each frame.
 */
export function phenomenonLayer(c: Pick<CenterStone, "phenomenon" | "rays" | "color" | "clarity">, geo: THREE.BufferGeometry, L: number, W: number): THREE.Mesh | null {
  if (c.phenomenon === "none") return null;
  const lines = c.phenomenon === "star" ? c.rays / 2 : 1;
  const mat = new THREE.ShaderMaterial({
    vertexShader: STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms: {
      halfSize: { value: new THREE.Vector2(W / 2, L / 2) },
      offset: { value: new THREE.Vector2() },
      lines: { value: lines },
      // stars show best on milky, silky stones; a clear stone's star is fainter
      strength: { value: 0.55 + (1 - c.clarity) * 0.45 },
      tint: { value: new THREE.Color(c.color).lerp(new THREE.Color(1, 1, 1), 0.82) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const layer = new THREE.Mesh(geo, mat);
  layer.scale.setScalar(1.004);
  layer.renderOrder = 4;
  layer.raycast = () => {}; // clicks go to the stone itself
  const cam = new THREE.Vector3();
  layer.onBeforeRender = (_r, _s, camera) => {
    cam.copy(camera.position);
    layer.worldToLocal(cam).normalize();
    mat.uniforms.offset.value.set(cam.x * 0.35, cam.z * 0.35); // halfway between the overhead light and the viewer
  };
  return layer;
}

/** a repeatable random sequence, so the same stone always has the same inclusions */
function seeded(seed: number) {
  let s = Math.floor(seed * 9973) % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * Inclusions as small dark crystals and pale feathers inside the stone, more of them the more included it is. They
 * are drawn over the stone (it would otherwise hide them) and kept well inside its outline.
 */
export function inclusionSpecks(c: Pick<CenterStone, "inclusions" | "cut" | "lengthMm" | "widthMm">, fn: OutlineFn, L: number, W: number, dome: number): THREE.Group | null {
  const n = Math.round(c.inclusions * 18);
  if (n < 1) return null;
  const rnd = seeded(c.lengthMm * 31 + c.widthMm * 17 + c.inclusions * 101);
  const cab = c.cut === "cabochon" || c.cut === "carved";
  const yLo = cab ? dome * 0.1 : -W * 0.18, yHi = cab ? dome * 0.55 : Math.max(0.1, dome * 0.5);
  const crystals = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x24201c, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }), n);
  const feathers = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), new THREE.MeshBasicMaterial({ color: 0xf6f3ea, transparent: true, opacity: 0.32, depthTest: false, depthWrite: false, side: THREE.DoubleSide }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  let nc = 0, nf = 0;
  for (let i = 0; i < n; i++) {
    const [x, z] = fn(rnd());
    const k = 0.15 + Math.sqrt(rnd()) * 0.5; // well inside the outline
    p.set(x * k, yLo + (yHi - yLo) * rnd(), z * k);
    if (rnd() < 0.6) {
      const r = W * (0.008 + rnd() * 0.014);
      m.compose(p, q.identity(), sc.set(r, r * (0.6 + rnd() * 0.5), r));
      crystals.setMatrixAt(nc++, m);
    } else {
      const r = W * (0.025 + rnd() * 0.04) * (0.5 + c.inclusions);
      m.compose(p, q.setFromEuler(e.set(rnd() * Math.PI, rnd() * Math.PI, 0)), sc.set(r, r * (0.35 + rnd() * 0.4), 1));
      feathers.setMatrixAt(nf++, m);
    }
  }
  crystals.count = nc; feathers.count = nf;
  const g = new THREE.Group();
  for (const mesh of [crystals, feathers]) {
    mesh.renderOrder = 5;
    mesh.raycast = () => {};
    if (mesh.count) g.add(mesh);
  }
  return g;
}
