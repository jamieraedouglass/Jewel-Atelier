

/** Types and labels shared by the 3D canvas and the components around it (kept free of three.js so they load fast). */

export type View = "hero" | "top" | "detail";
export const VIEW_LABEL: Record<View, string> = { hero: "¾", top: "Top", detail: "Detail" };
export type Cutout = { url: string; mmPerPx: number; widthMm: number; heightMm: number };
export type RingCanvasHandle = {
  snapshot: (type?: "image/jpeg" | "image/png") => Promise<Blob | null>;
  /** a true-to-scale picture of one piece (one earring of a pair) on a clear background, for trying it on a photo */
  cutout?: (mode?: "whole" | "front", ear?: "left" | "right", flatten?: number) => Cutout | null;
  /** a picture from the standard ¾ view, whatever angle the viewer has turned to (for gallery thumbnails) */
  hero?: () => Promise<Blob | null>;
};
/** real size of the piece, mm: across, top to bottom, and how thick */
export type Measure = { widthMm: number; lengthMm: number; depthMm: number; what: string };

export type Part = "center" | "accents" | "sides" | "metal" | "fringe" | "extra" | "motif" | "drop";
export type Pick = { part: Part; x: number; y: number; index?: number; ear?: "left" | "right" };
