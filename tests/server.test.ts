import { describe, expect, it } from "vitest";
import { dailyLimit } from "@/lib/usage";
import { CHAT_SYSTEM, proposeDesignTool } from "@/lib/ai";

describe("dailyLimit", () => {
  it("reads a sensible AI_DAILY_LIMIT", () => {
    expect(dailyLimit("25")).toBe(25);
  });
  it("falls back to 40 for missing or nonsensical values instead of locking everyone out", () => {
    for (const raw of [undefined, "", "abc", "0", "-3"]) expect(dailyLimit(raw), String(raw)).toBe(40);
  });
});

describe("chat tool", () => {
  it("tells Claude about the colour grades", () => {
    expect(CHAT_SYSTEM).toContain("Colombian");
    expect(CHAT_SYSTEM).toContain("pigeon's blood");
  });
  it("lets Claude set a stone's glow", () => {
    const patch = (proposeDesignTool.input_schema.properties as Record<string, { properties: Record<string, { properties: Record<string, unknown> }> }>).patch;
    expect(patch.properties.center.properties.glow).toBeDefined();
  });
});
