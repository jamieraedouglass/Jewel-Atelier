import { describe, expect, it } from "vitest";
import { wrapRound } from "@/lib/wrapRound";

// A strip one pixel high, each column's red channel set to its distance in mm from the centre, so the wrap can be read back.
const strip = (halfMm: number) => {
  const width = halfMm * 2, data = new Uint8ClampedArray(width * 4);
  for (let i = 0; i < width; i++) { data[i * 4] = Math.abs(i + 0.5 - halfMm); data[i * 4 + 3] = 255; }
  return { data, width, height: 1 };
};

describe("wrapping a choker round the neck", () => {
  it("keeps the middle true size, narrows to the neck's width, and foreshortens the sides", () => {
    const out = wrapRound(strip(85), 85, 1, 56.6);
    expect(out.width).toBeLessThanOrEqual(2 * 57);
    expect(out.width).toBeGreaterThan(2 * 55);
    const at = (x: number) => out.data[(Math.round(out.width / 2 + x - 0.5)) * 4];
    expect(Math.abs(at(5) - 5)).toBeLessThanOrEqual(1);
    // 50 mm out on the neck's front is about 62 mm along the band.
    expect(Math.abs(at(50) - 56.6 * Math.asin(50 / 56.6))).toBeLessThan(1.5);
  });
});
