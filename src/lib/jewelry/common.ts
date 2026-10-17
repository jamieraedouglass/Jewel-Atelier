import * as THREE from "three";
import { type Gem } from "../design";

export type Piece = {
  group: THREE.Group;
  focus: THREE.Vector3;
  focusSize: number;
  upright: boolean;
};

export const Y = new THREE.Vector3(0, 1, 0);
export const COLORLESS = new Set<Gem>(["diamond", "aquamarine", "opal"]);
export const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
