import { describe, expect, it } from "vitest";
import { KEEP_MESSAGES, chatForApi, normalizeChat, type ChatMessage } from "@/lib/chat";

describe("stored conversations", () => {
  it("keep readable messages and drop broken ones", () => {
    const m = normalizeChat([{ role: "user", content: "hi" }, { role: "robot", content: "?" }, null, { role: "assistant", content: "hello", proposals: [{ title: "Gold", patch: { metal: "yellow-gold" }, state: "applied" }] }]);
    expect(m.map((x) => x.role)).toEqual(["user", "assistant"]);
    expect(m[1].proposals?.[0].why).toBe("");
    expect(normalizeChat("nope")).toEqual([]);
  });

  it("keep only the newest messages", () => {
    const many = Array.from({ length: KEEP_MESSAGES + 10 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: String(i) }));
    const kept = normalizeChat(many);
    expect(kept).toHaveLength(KEEP_MESSAGES);
    expect(kept[kept.length - 1].content).toBe(String(KEEP_MESSAGES + 9));
  });
});

describe("conversation sent to the consultant", () => {
  const convo: ChatMessage[] = [
    { role: "assistant", content: "orphan reply" },
    { role: "user", content: "ideas?" },
    { role: "assistant", content: "Try these", proposals: [
      { title: "Platinum", why: "", patch: { metal: "platinum" }, state: "dismissed" },
      { title: "Emerald", why: "", patch: { center: { gem: "emerald" } }, state: "applied" },
    ] },
  ];

  it("starts with their message and remembers what they did with each suggestion", () => {
    const api = chatForApi(convo);
    expect(api[0]).toEqual({ role: "user", content: "ideas?" });
    expect(api[1].content).toContain("Platinum — metal: platinum (they turned it down)");
    expect(api[1].content).toContain("Emerald — center gem: emerald (they applied it)");
  });

  it("fits the API's 40-message limit", () => {
    const long: ChatMessage[] = Array.from({ length: 55 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: String(i) }));
    const api = chatForApi(long);
    expect(api.length).toBeLessThanOrEqual(40);
    expect(api[0].role).toBe("user");
  });
});
