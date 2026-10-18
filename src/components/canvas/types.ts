export type View = "hero" | "top" | "detail";
export const VIEW_LABEL: Record<View, string> = { hero: "¾", top: "Top", detail: "Detail" };
export type Cutout = { url: string; mmPerPx: number; widthMm: number; heightMm: number };
export type RingCanvasHandle = {
  snapshot: (type?: "image/jpeg" | "image/png") => Promise<Blob | null>;
  cutout?: (mode?: "whole" | "front", ear?: "left" | "right", flatten?: number) => Cutout | null;
  hero?: () => Promise<Blob | null>;
};
export type Measure = { widthMm: number; lengthMm: number; depthMm: number; what: string };

export type Part = "center" | "accents" | "sides" | "metal" | "fringe" | "extra" | "motif" | "drop";
export type Pick = { part: Part; x: number; y: number; index?: number; ear?: "left" | "right"; stoneKey?: string };
