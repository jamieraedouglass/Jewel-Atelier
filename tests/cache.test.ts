import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { LRU, geometryCache, isShared } from "@/lib/cache";
import { disposeGroup } from "@/lib/ringModel";

describe("LRU", () => {
  it("evicts the least recently used entry", () => {
    const evicted: string[] = [];
    const c = new LRU<string, number>(2, (_, k) => evicted.push(k));
    c.set("a", 1).set("b", 2);
    c.get("a");
    c.set("c", 3);
    expect(evicted).toEqual(["b"]);
    expect(c.has("a") && c.has("c")).toBe(true);
    expect(c.size).toBe(2);
  });
});

describe("shared geometry", () => {
  it("is built once per key and survives disposing a piece that uses it", () => {
    const cache = geometryCache(10);
    const make = vi.fn(() => new THREE.BoxGeometry());
    const g = cache("k", make);
    expect(cache("k", make)).toBe(g);
    expect(make).toHaveBeenCalledTimes(1);
    expect(isShared(g)).toBe(true);

    const dispose = vi.fn();
    g.addEventListener("dispose", dispose);
    const own = new THREE.BoxGeometry();
    const ownDispose = vi.fn();
    own.addEventListener("dispose", ownDispose);
    const group = new THREE.Group();
    group.add(new THREE.Mesh(g), new THREE.Mesh(own));
    disposeGroup(group);
    expect(dispose).not.toHaveBeenCalled();
    expect(ownDispose).toHaveBeenCalled();
  });

  it("is disposed when it falls out of the cache", () => {
    const cache = geometryCache(1);
    const first = cache("a", () => new THREE.BoxGeometry());
    const dispose = vi.fn();
    first.addEventListener("dispose", dispose);
    cache("b", () => new THREE.BoxGeometry());
    expect(dispose).toHaveBeenCalled();
  });
});
