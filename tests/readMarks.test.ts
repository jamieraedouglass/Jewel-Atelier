import { describe, expect, it } from "vitest";
import { imageSize, marksToFractions } from "@/lib/ai/readPiece";

const jpeg = (w: number, h: number) => Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x4a, 0x46, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x03, 0, 0, 0, 0]);

describe("photo reading marks", () => {
  it("reads a JPEG's size from its header", () => {
    expect(imageSize(jpeg(1290, 1412))).toEqual({ w: 1290, h: 1412 });
    expect(imageSize(Uint8Array.from([1, 2, 3]))).toBeNull();
  });
  it("turns pixel marks into fractions of each photo", () => {
    const r = marksToFractions({ main: { photo: 0, x: 129, y: 141.2, w: 645, h: 706 }, groups: [{ marks: [{ photo: 1, x: 50, y: 100, r: 10 }] }] }, [{ w: 1290, h: 1412 }, { w: 100, h: 200 }]) as never as { main: Record<string, number>; groups: { marks: Record<string, number>[] }[] };
    for (const [k, v] of Object.entries({ x: 0.1, y: 0.1, w: 0.5, h: 0.5 })) expect(r.main[k]).toBeCloseTo(v, 6);
    for (const [k, v] of Object.entries({ x: 0.5, y: 0.5, r: 0.1 })) expect(r.groups[0].marks[0][k]).toBeCloseTo(v, 6);
  });
  it("leaves marks that are already fractions alone", () => {
    const r = marksToFractions({ main: { photo: 0, x: 0.2, y: 0.3, w: 0.4, h: 0.3 } }, [{ w: 1000, h: 1000 }]) as { main: Record<string, number> };
    expect(r.main.x).toBe(0.2);
  });
});
