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

/**
 * Builds any piece from a Design.
 * Rings stand upright (see ringModel.ts). Everything else is laid flat like a jeweller's flat-lay photo:
 * stones face +Y and gravity points to +Z, so drops, fringes and pendants hang toward the viewer.
 * Each piece type's builder lives in src/lib/jewelry/.
 */
export function buildPiece(d: Design): Piece {
  const p = buildWhole(d);
  if (accentsOff(d)) withoutAccents(p.group);
  return p;
}

/** take the accent stones out of a built piece, leaving the main stone and the metal */
function withoutAccents(group: THREE.Object3D) {
  const gone: THREE.Object3D[] = [];
  // a kept group (the half-flower's petals, band stones, Deco layers) is part of the design: leave it and all inside it
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

/** build with the loop flattened (worn look): stones keep their shape and spacing, only the loop's path changes */
export function buildWornPiece(d: Design, flatten: number): Piece {
  return withLoopFlatten(flatten, () => buildPiece(d));
}
