import { describe, expect, it } from "vitest";
import { directionFromNotes } from "@/lib/ai/recreate";

describe("centre stone direction from notes", () => {
  it("reads along and across the finger", () => {
    expect(directionFromNotes("The marquise points ALONG the finger.")).toBe(0);
    expect(directionFromNotes("the stone lies across the finger")).toBe(90);
  });
  it("only turns the stone diagonal when the stone itself is diagonal", () => {
    expect(directionFromNotes("the diamond is set diagonally")).toBe(45);
    expect(directionFromNotes("turned 45°")).toBe(45);
    expect(directionFromNotes("emerald leaves winding through every band in diagonal vines")).toBeNull();
    expect(directionFromNotes("Main stone: diamond, about 15 x 8 mm, judged against the fingertips; set on the diagonal in the photo")).toBeNull();
  });
  it("lets an explicit direction win over other mentions", () => {
    expect(directionFromNotes("It points ALONG the finger, with leaves in diagonal vines")).toBe(0);
  });
});
