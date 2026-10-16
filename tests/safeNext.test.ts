import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safeNext";

describe("safeNext", () => {
  it("keeps paths on this site", () => {
    expect(safeNext("/design/abc")).toBe("/design/abc");
    expect(safeNext("/d/1?x=2#y")).toBe("/d/1?x=2#y");
  });

  it("refuses anything that leaves the site", () => {
    for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\t/evil.com", "javascript:alert(1)", "", null, undefined, 42])
      expect(safeNext(bad), String(bad)).toBe("/design");
  });

  it("uses the given fallback", () => {
    expect(safeNext("//x", "/rings")).toBe("/rings");
  });
});
