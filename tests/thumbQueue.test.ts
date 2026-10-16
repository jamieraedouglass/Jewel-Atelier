import { describe, expect, it } from "vitest";
import { defaultDesign } from "@/lib/design";
import { thumbQueue } from "@/components/gallery/thumbQueue";

describe("thumbnail queue", () => {
  it("draws one design at a time, in the order asked", async () => {
    const a = thumbQueue.request("a", defaultDesign());
    const b = thumbQueue.request("b", defaultDesign());
    expect(thumbQueue.current()?.id).toBe("a");
    const blob = new Blob(["x"]);
    thumbQueue.finish(thumbQueue.current()!, blob);
    expect(await a.picture).toBe(blob);
    expect(thumbQueue.current()?.id).toBe("b");
    b.cancel();
    expect(await b.picture).toBeNull();
    expect(thumbQueue.current()).toBeNull();
  });

  it("drops a card that leaves the page before its turn", async () => {
    const a = thumbQueue.request("a", defaultDesign());
    const b = thumbQueue.request("b", defaultDesign());
    b.cancel();
    expect(await b.picture).toBeNull();
    thumbQueue.finish(thumbQueue.current()!, null);
    expect(await a.picture).toBeNull();
    expect(thumbQueue.current()).toBeNull();
  });

  it("tells listeners when the queue moves", () => {
    let calls = 0;
    const off = thumbQueue.subscribe(() => calls++);
    const a = thumbQueue.request("a", defaultDesign());
    a.cancel();
    off();
    expect(calls).toBe(2);
  });
});
