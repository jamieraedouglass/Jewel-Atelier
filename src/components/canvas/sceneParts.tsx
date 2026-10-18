import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { type Piece } from "@/lib/jewelryModel";
import { disposeGroup } from "@/lib/ringModel";
import { type Part, type Pick, type View } from "./types";
import { framing } from "./framing";

export function Model({ piece }: { piece: Piece }) {
  useEffect(() => () => { setTimeout(() => disposeGroup(piece.group), 0); }, [piece]);
  return <primitive object={piece.group} />;
}

export function ClickPicker({ piece, onPick, onMiss }: { piece: Piece; onPick?: (p: Pick) => void; onMiss?: () => void }) {
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
      if (moved > 5) return;
      const r = el.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      piece.group.updateWorldMatrix(true, true);
      const hit = ray.intersectObject(piece.group, true)[0];
      if (!hit) { onMiss?.(); return; }
      let o: THREE.Object3D | null = hit.object;
      let index: number | undefined;
      while (o && !o.userData.part) o = o.parent;
      for (let q: THREE.Object3D | null = o; q; q = q.parent) if (typeof q.userData.dropIndex === "number") { index = q.userData.dropIndex; break; }
      let ear: "left" | "right" | undefined;
      for (let q: THREE.Object3D | null = hit.object; q; q = q.parent) if (q.userData.ear) { ear = q.userData.ear; break; }
      let stoneKey: string | undefined;
      const keys = hit.object.userData.keys as string[] | undefined;
      if (keys && hit.instanceId !== undefined && keys[hit.instanceId]) stoneKey = keys[hit.instanceId];
      else for (let q: THREE.Object3D | null = hit.object; q; q = q.parent) if (typeof q.userData.stoneKey === "string") { stoneKey = q.userData.stoneKey; break; }
      onPick({ part: index !== undefined ? "drop" : ((o?.userData.part as Part) ?? "metal"), index, ear, stoneKey, x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => { el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointerup", onUp); };
  }, [camera, gl]);
  return null;
}

export function CameraRig({ view, piece, frameKey, controls }: { view: View; piece: Piece; frameKey: string; controls: React.RefObject<OrbitControlsImpl> }) {
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
    // Leftover spin momentum would keep turning the camera after it lands, twisting a straight-on view.
    const settle = () => { if (!ctl) return; const damp = ctl.enableDamping; ctl.enableDamping = false; ctl.update(); ctl.enableDamping = damp; };
    settle();
    let t = 0, raf = 0;
    const step = () => {
      t = Math.min(1, t + 0.04);
      const e = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(fromP, toP, e);
      ctl?.target.lerpVectors(fromT, toT, e);
      if (t < 1) { ctl?.update(); raf = requestAnimationFrame(step); } else settle();
    };
    step();
    return () => cancelAnimationFrame(raf);
  }, [view, frameKey, camera, controls]);
  return null;
}
