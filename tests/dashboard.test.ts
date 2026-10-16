import { describe, expect, it } from "vitest";
import { eventText, studioSummary, type DashEvent, type DashLink } from "@/lib/studio/dashboard";

const now = Date.parse("2026-10-17T12:00:00Z");
const links: DashLink[] = [
  { id: "L1", client_name: "Meher", design_ids: ["d1", "d2"], created_at: "2026-10-10T00:00:00Z", last_opened_at: "2026-10-16T00:00:00Z", expires_at: null, revoked: false },
  { id: "L2", client_name: "Rohan", design_ids: ["d2"], created_at: "2026-09-01T00:00:00Z", last_opened_at: null, expires_at: "2026-10-01T00:00:00Z", revoked: false },
];
const events: DashEvent[] = [
  { id: 1, link_id: "L1", design_id: null, kind: "opened", detail: {}, at: "2026-10-16T09:00:00Z" },
  { id: 2, link_id: "L1", design_id: "d1", kind: "changed", detail: { changes: ["Ring size US 6.5 → 7"] }, at: "2026-10-16T09:05:00Z" },
  { id: 3, link_id: "L1", design_id: "d1", kind: "asked-jeweller", detail: { message: "Price in 22k?" }, at: "2026-10-16T09:10:00Z" },
  { id: 4, link_id: "L1", design_id: "d2", kind: "asked-designer", detail: { question: "Is it heavy?" }, at: "2026-10-16T09:07:00Z" },
];
const names = { d1: "Half-flower ring", d2: "Kashi Kamal earrings" };

describe("studio dashboard", () => {
  it("counts what matters", () => {
    const s = studioSummary(links, events, names, now);
    expect(s.tiles).toEqual({ activeLinks: 1, openedThisWeek: 1, messages: 1, designerQuestions: 1 });
    expect(s.links[0]).toMatchObject({ clientName: "Meher", pieces: ["Half-flower ring", "Kashi Kamal earrings"], state: "active", opens: 1, changes: 1, questions: 2, waiting: true });
    expect(s.links[1].state).toBe("expired");
  });

  it("writes events as sentences, newest first, with messages to the jeweller up top", () => {
    const s = studioSummary(links, events, names, now);
    expect(s.feed[0].text).toBe('Meher wrote to you about Half-flower ring: "Price in 22k?"');
    expect(s.feed.map((f) => f.text)).toContain("Meher changed Half-flower ring: Ring size US 6.5 → 7");
    expect(s.needsYou).toHaveLength(1);
    expect(s.mostViewed[0]).toEqual({ name: "Half-flower ring", interactions: 2 });
  });

  it("describes each kind of event", () => {
    expect(eventText({ kind: "tried-on", detail: {} }, null)).toBe("tried the pieces on together");
    expect(eventText({ kind: "changed", detail: { changes: [] } }, "Ring")).toBe("went back to the original Ring");
    expect(eventText({ kind: "compared", detail: {} }, null)).toBe("compared pieces side by side");
  });
});
