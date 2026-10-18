import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const adminRpc = vi.fn(async (..._args: unknown[]) => ({ error: null }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ rpc: adminRpc }) }));

const { chargeAiCall } = await import("@/lib/usage");
const client = (allowed: boolean) => ({ rpc: vi.fn(async () => ({ data: allowed, error: null })) }) as unknown as SupabaseClient;

describe("chargeAiCall", () => {
  it("refuses once the day's limit is reached", async () => {
    const r = await chargeAiCall(client(false), "u1");
    expect("error" in r && r.error).toMatch(/today's/);
  });

  it("gives the call back once, through the server-only function, when the request fails", async () => {
    adminRpc.mockClear();
    const r = await chargeAiCall(client(true), "u1");
    if ("error" in r) throw new Error("should be charged");
    await r.refund();
    await r.refund();
    expect(adminRpc).toHaveBeenCalledTimes(1);
    expect(adminRpc).toHaveBeenCalledWith("refund_ai_call", { uid: "u1" });
  });

  it("never fails the request if the refund can't be made", async () => {
    adminRpc.mockImplementationOnce(async () => { throw new Error("no key"); });
    const r = await chargeAiCall(client(true), "u1");
    if ("error" in r) throw new Error("should be charged");
    await expect(r.refund()).resolves.toBeUndefined();
  });
});

describe("higher limits for named accounts", () => {
  it("gives listed names the higher limit and everyone else the normal one", async () => {
    const { limitFor, DAILY_LIMIT } = await import("@/lib/usage");
    const { emailForName } = await import("@/lib/names");
    expect(limitFor(emailForName("Jamie"), "Jamie, Carl", "250")).toBe(250);
    expect(limitFor(emailForName("Carl"), "Jamie, Carl")).toBe(300);
    expect(limitFor(emailForName("Someone"), "Jamie")).toBe(DAILY_LIMIT);
    expect(limitFor(null, "Jamie")).toBe(DAILY_LIMIT);
  });
});
