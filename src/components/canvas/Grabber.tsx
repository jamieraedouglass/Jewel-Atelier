import type { Design } from "@/lib/design";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { type Piece, buildWornPiece } from "@/lib/jewelryModel";
import { disposeGroup } from "@/lib/ringModel";
import { type RingCanvasHandle } from "./types";
import { FOV, framing, subjectOf } from "./framing";
import { roomLight } from "./stoneLight";

export function Grabber({ piece, design, handle }: { piece: Piece; design: Design; handle?: React.MutableRefObject<RingCanvasHandle | null> }) {
  const { gl, scene } = useThree();
  const latest = useRef({ piece, design });
  latest.current = { piece, design };
  useEffect(() => {
    if (!handle?.current) return;
    handle.current.hero = () => new Promise((res) => {
      const { piece } = latest.current;
      const el = gl.domElement;
      const { pos, target } = framing(piece, "hero");
      const cam = new THREE.PerspectiveCamera(FOV, el.width / el.height, 0.2, pos.distanceTo(target) * 10);
      cam.position.copy(pos); cam.lookAt(target); cam.updateProjectionMatrix();
      const auto = gl.autoClear, rt = gl.getRenderTarget();
      gl.setRenderTarget(null); gl.autoClear = true;
      gl.render(scene, cam);
      el.toBlob((b) => { gl.autoClear = auto; gl.setRenderTarget(rt); res(b); }, "image/jpeg", 0.9);
    });
    handle.current.cutout = (mode = "whole", ear = "left", flatten = 1) => {
      const { piece: shown, design } = latest.current;
      const worn = mode === "front" && flatten < 0.999 && !shown.upright ? buildWornPiece(design, flatten) : null;
      const piece = worn ?? shown;
      if (worn) { roomLight(gl, worn.group); shown.group.visible = false; scene.add(worn.group); }
      const done = <T,>(v: T) => { if (worn) { scene.remove(worn.group); disposeGroup(worn.group); shown.group.visible = true; } return v; };
      const { obj, hide } = subjectOf(piece, design, ear);
      piece.group.updateWorldMatrix(true, true);
      hide.forEach((h) => (h.visible = false));
      const box = new THREE.Box3().setFromObject(obj);
      hide.forEach((h) => (h.visible = true));
      if (box.isEmpty()) return done(null);
      let clip: THREE.Plane | null = null;
      if (mode === "front" && !piece.upright) {
        const cz = (box.min.z + box.max.z) / 2;
        clip = new THREE.Plane(new THREE.Vector3(0, 0, 1), -cz);
        box.min.z = cz;
      }
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
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
      const hidden: THREE.Object3D[] = [];
      scene.children.forEach((o) => { if (o !== piece.group && o.visible && !(o as THREE.Light).isLight) { o.visible = false; hidden.push(o); } });
      hide.forEach((h) => { h.visible = false; hidden.push(h); });
      const bg = scene.background, clear = gl.getClearAlpha(), prevColor = gl.getClearColor(new THREE.Color()), auto = gl.autoClear, target = gl.getRenderTarget();
      const prevClip = gl.clippingPlanes;
      const mmPerPx = fw / cw;
      const wPx = Math.ceil(spanX / mmPerPx), hPx = Math.ceil(spanY / mmPerPx);
      const grab = (background: THREE.Color | null) => {
        scene.background = background;
        gl.setRenderTarget(null);
        gl.setClearColor(0x000000, 0);
        gl.autoClear = true;
        gl.clear(true, true, true);
        if (clip) gl.clippingPlanes = [clip];
        gl.render(scene, cam);
        gl.clippingPlanes = prevClip;
        const cv = document.createElement("canvas"); cv.width = wPx; cv.height = hPx;
        const cx2 = cv.getContext("2d")!;
        cx2.drawImage(el, (cw - wPx) / 2, (ch - hPx) / 2, wPx, hPx, 0, 0, wPx, hPx);
        return cx2.getImageData(0, 0, wPx, hPx);
      };
      const calmed: [THREE.MeshPhysicalMaterial, number][] = [];
      piece.group.traverse((o) => {
        const mt = (o as THREE.Mesh).material as THREE.MeshPhysicalMaterial | undefined;
        if (mt && !Array.isArray(mt) && mt.flatShading && mt.metalness > 0.9 && !calmed.some(([x]) => x === mt)) { calmed.push([mt, mt.envMapIntensity]); mt.envMapIntensity *= 0.35; }
      });
      const colour = grab(new THREE.Color("#a88a76"));
      calmed.forEach(([mt, v]) => (mt.envMapIntensity = v));
      const mask = grab(null);
      const out = document.createElement("canvas");
      out.width = wPx; out.height = hPx;
      const octx = out.getContext("2d")!;
      const px = colour.data, mk = mask.data;
      for (let i = 0; i < px.length; i += 4) {
        px[i + 3] = Math.min(255, mk[i + 3] * 5);
        const r = px[i], g = px[i + 1], b = px[i + 2], l = 0.3 * r + 0.59 * g + 0.11 * b;
        const sat = 1.45, con = 1.12;
        px[i] = Math.max(0, Math.min(255, ((l + (r - l) * sat) - 128) * con + 128));
        px[i + 1] = Math.max(0, Math.min(255, ((l + (g - l) * sat) - 128) * con + 128));
        px[i + 2] = Math.max(0, Math.min(255, ((l + (b - l) * sat) - 128) * con + 128));
      }
      octx.putImageData(colour, 0, 0);
      scene.background = bg; gl.setClearColor(prevColor, clear); gl.autoClear = auto; gl.setRenderTarget(target);
      hidden.forEach((o) => (o.visible = true));
      return done({ url: out.toDataURL("image/png"), mmPerPx, widthMm: spanX, heightMm: spanY });
    };
  }, [gl, scene, handle]);
  return null;
}
