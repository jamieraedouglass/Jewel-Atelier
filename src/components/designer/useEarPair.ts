"use client";

import { useRef, useState } from "react";
import { applyPatchLenient as applyPatch, asRightEar, rightEarDesign, type Design, type DesignPatch } from "@/lib/design";

const PAIR_KEYS = new Set(["metal", "purity", "name", "rightEar", "mirrorPair"]);

export function useEarPair(designRef: React.MutableRefObject<Design>, record: (next: Design, group: boolean) => void) {
  const [ear, setEar] = useState<"left" | "right">("left");
  const earRef = useRef(ear);
  earRef.current = ear;
  const design = designRef.current;
  const unmatched = design.type === "earrings" && !!design.rightEar;
  const onRight = () => designRef.current.type === "earrings" && !!designRef.current.rightEar && earRef.current === "right";

  const change = (patch: DesignPatch) => {
    const cur = designRef.current;
    if (!onRight() || patch.type) return record(applyPatch(cur, patch), true);
    const pairPart: Record<string, unknown> = {}, earPart: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) (PAIR_KEYS.has(k) ? pairPart : earPart)[k] = v;
    const base = Object.keys(pairPart).length ? applyPatch(cur, pairPart as DesignPatch) : cur;
    record({ ...base, rightEar: asRightEar(applyPatch(rightEarDesign(base), earPart as DesignPatch)) }, true);
  };
  const replace = (d: Design) => {
    const cur = designRef.current;
    if (onRight() && d.type === "earrings") return record({ ...cur, rightEar: asRightEar(d) }, false);
    record(d, false);
  };
  function setMatched(matched: boolean) {
    const cur = designRef.current;
    if (matched) { record({ ...cur, rightEar: null }, false); setEar("left"); }
    else record({ ...cur, rightEar: asRightEar(cur) }, false);
  }
  const editing = unmatched && ear === "right" ? rightEarDesign(design) : design;
  return { ear, setEar, unmatched, change, replace, setMatched, editing };
}
