import { describe, expect, it } from "vitest";
import { isPreviewBot, linkPreviewText, thumbnailUrl } from "@/lib/studio/preview";

describe("client link previews", () => {
  it("tells preview robots from people", () => {
    for (const ua of ["WhatsApp/2.23.20.0 A", "facebookexternalhit/1.1 Facebot Twitterbot/1.0", "TelegramBot (like TwitterBot)", "Slackbot-LinkExpanding 1.0", "Mozilla/5.0 (compatible; Googlebot/2.1)", "", null])
      expect(isPreviewBot(ua), String(ua)).toBe(true);
    for (const ua of ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"])
      expect(isPreviewBot(ua), ua).toBe(false);
  });
  it("names the piece and the client", () => {
    expect(linkPreviewText("Kotharis Jewellers", "Meher", ["Half-flowered ruby ring", "Kashi Kamal earrings"]).title).toBe("Half-flowered ruby ring and 1 more · for Meher");
    expect(linkPreviewText("Kotharis Jewellers", "", ["Ring"]).title).toBe("Ring");
    expect(linkPreviewText("Kotharis Jewellers", "Meher", ["Ring"]).description).toMatch(/Kotharis Jewellers/);
  });
  it("builds the public picture address", () => {
    expect(thumbnailUrl("https://x.supabase.co/", "u1/d 1.jpg")).toBe("https://x.supabase.co/storage/v1/object/public/thumbnails/u1/d%201.jpg");
    expect(thumbnailUrl(undefined, "a.jpg")).toBeNull();
    expect(thumbnailUrl("https://x.supabase.co", null)).toBeNull();
  });
});
