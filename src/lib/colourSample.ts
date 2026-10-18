import { type Design, type DesignPatch, applyPatchLenient } from "./design";

export type Sample = { target: string; photo: number; x: number; y: number };
type Pixels = { data: Uint8ClampedArray; width: number; height: number };

const hsl = (r: number, g: number, b: number) => {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
};
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;
const parse = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];

export function sampleAt(px: Pixels, x: number, y: number): string | null {
  const R = Math.max(2, Math.round(Math.min(px.width, px.height) * 0.012));
  const cx = Math.round(x * (px.width - 1)), cy = Math.round(y * (px.height - 1));
  const pts: [number, number, number, number][] = [];
  for (let dy = -R; dy <= R; dy++) for (let dx = -R; dx <= R; dx++) {
    if (dx * dx + dy * dy > R * R) continue;
    const X = cx + dx, Y = cy + dy;
    if (X < 0 || Y < 0 || X >= px.width || Y >= px.height) continue;
    const i = (Y * px.width + X) * 4, r = px.data[i] / 255, g = px.data[i + 1] / 255, b = px.data[i + 2] / 255;
    pts.push([r, g, b, 0.2126 * r + 0.7152 * g + 0.0722 * b]);
  }
  if (pts.length < 5) return null;
  pts.sort((a, b) => a[3] - b[3]);
  const mid = pts.slice(Math.floor(pts.length * 0.25), Math.ceil(pts.length * 0.75));
  const avg = [0, 1, 2].map((k) => mid.reduce((a, p) => a + p[k], 0) / mid.length) as [number, number, number];
  const { l } = hsl(...avg);
  return l < 0.06 || l > 0.97 ? null : hex(...avg);
}

export function believable(sampled: string, expected: string | undefined) {
  if (!expected) return true;
  const a = hsl(...parse(sampled)), b = hsl(...parse(expected));
  if (b.s < 0.15 || a.s < 0.12) return Math.abs(a.s - b.s) < 0.35;
  const dh = Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h));
  return dh < 55;
}

export function colourPatch(d: Design, target: string, colour: string): { patch: DesignPatch; was?: string } | null {
  const [kind, idx, alt] = target.split(":");
  const i = Number(idx);
  if (kind === "center") return { patch: { center: { color: colour } }, was: d.center.color };
  if (kind === "accents") return { patch: { accents: { color: colour } }, was: d.accents.color };
  if (kind === "band") return { patch: { band: { paveColor: colour } }, was: d.band.paveColor };
  if (kind === "fringe") return { patch: { fringe: { color: colour } }, was: d.fringe.color };
  if (kind === "frame" && d.frames[i]) {
    const f = d.frames[i];
    if (alt === "alt") return f.alt ? { patch: { frames: d.frames.map((x, k) => (k === i && x.alt ? { ...x, alt: { ...x.alt, color: colour } } : x)) } as DesignPatch, was: f.alt.color } : null;
    return { patch: { frames: d.frames.map((x, k) => (k === i ? { ...x, color: colour } : x)) } as DesignPatch, was: f.color };
  }
  if (kind === "part" && d.drop.parts[i]) return { patch: { drop: { parts: d.drop.parts.map((p, k) => (k === i ? { ...p, stone: { ...p.stone, color: colour } } : p)) } } as DesignPatch, was: d.drop.parts[i].stone.color };
  return null;
}

export async function photoPixels(blobs: Blob[]): Promise<Pixels[]> {
  return Promise.all(blobs.map(async (b) => {
    const bmp = await createImageBitmap(b);
    const k = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(bmp, 0, 0, w, h);
    return { data: ctx.getImageData(0, 0, w, h).data, width: w, height: h };
  }));
}

export function withPhotoColours(d: Design, samples: Sample[], photos: Pixels[]): { design: Design; used: number } {
  let out = d, used = 0;
  const seen = new Set<string>();
  for (const s of samples) {
    if (seen.has(s.target) || !photos[s.photo]) continue;
    const colour = sampleAt(photos[s.photo], s.x, s.y);
    if (!colour) continue;
    const c = colourPatch(out, s.target, colour);
    if (!c || !believable(colour, c.was)) continue;
    out = applyPatchLenient(out, c.patch);
    seen.add(s.target); used++;
  }
  return { design: out, used };
}
