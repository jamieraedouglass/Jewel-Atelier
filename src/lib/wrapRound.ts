// A choker seen from the front, as worn: the piece is drawn flat (its band running straight across), then each column of
// the picture is moved to where that point of the band would be once wrapped round a neck of radius R. The middle keeps
// its true size and the sides turn away and look shorter, as they do round a real neck; what would be behind the neck is
// left out. Rows are unchanged, so drops hang their full length.
export function wrapRound(src: { data: Uint8ClampedArray; width: number; height: number }, centrePx: number, mmPerPx: number, radiusMm: number) {
  const R = radiusMm / mmPerPx;
  const reach = Math.max(centrePx, src.width - centrePx);
  const half = Math.ceil(R * Math.sin(Math.min(reach / R, Math.PI / 2)));
  const width = half * 2, out = new Uint8ClampedArray(width * src.height * 4);
  for (let j = 0; j < width; j++) {
    const x = j + 0.5 - half;
    const s = R * Math.asin(Math.max(-1, Math.min(1, x / R)));
    const at = centrePx + s - 0.5, i0 = Math.floor(at), f = at - i0;
    if (i0 < -1 || i0 >= src.width) continue;
    for (let y = 0; y < src.height; y++) {
      const o = (y * width + j) * 4;
      for (let c = 0; c < 4; c++) {
        const a = i0 >= 0 ? src.data[(y * src.width + i0) * 4 + c] : 0;
        const b = i0 + 1 < src.width ? src.data[(y * src.width + i0 + 1) * 4 + c] : 0;
        out[o + c] = a + (b - a) * f;
      }
    }
  }
  return { data: out, width, height: src.height };
}
