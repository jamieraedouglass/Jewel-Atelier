import { accentsOff, type Design } from "./design";
import type * as THREE from "three";
import type { Piece } from "./jewelry/common";
import { makeMaterials } from "./jewelry/materials";
import { withLoopFlatten } from "./jewelry/curves";
import { motifPiece } from "./jewelry/motif";
import { ringPiece } from "./jewelry/ring";
import { earringPiece } from "./jewelry/earrings";
import { necklacePiece } from "./jewelry/necklace";
import { braceletPiece } from "./jewelry/bracelet";
import { ankletPiece, armletPiece, handPiece, headpiecePiece, nosePiece } from "./jewelry/smallPieces";
import { mensPiece } from "./jewelry/mens";
export type { Piece } from "./jewelry/common";

export function buildPiece(d: Design): Piece {
  const p = buildWhole(d);
  if (accentsOff(d)) withoutAccents(p.group);
  return p;
}

function withoutAccents(group: THREE.Object3D) {
  const gone: THREE.Object3D[] = [];
  const walk = (o: THREE.Object3D) => {
    if (o.userData.keep) return;
    if (o.userData.part === "accents") { gone.push(o); return; }
    o.children.forEach(walk);
  };
  walk(group);
  for (const o of gone) o.removeFromParent();
}

function buildWhole(d: Design): Piece {
  if (d.style.startsWith("motif")) return motifPiece(d, makeMaterials(d));
  if (d.type === "ring") return ringPiece(d);
  const m = makeMaterials(d);
  switch (d.type) {
    case "earrings": return earringPiece(d, m);
    case "necklace": return necklacePiece(d, m);
    case "bracelet": return braceletPiece(d, m);
    case "anklet": return ankletPiece(d, m);
    case "headpiece": return headpiecePiece(d, m);
    case "nose": return nosePiece(d, m);
    case "armlet": return armletPiece(d, m);
    case "hand": return handPiece(d, m);
    case "mens": return mensPiece(d, m);
  }
}

export function buildWornPiece(d: Design, flatten: number): Piece {
  return withLoopFlatten(flatten, () => buildPiece(d));
}
