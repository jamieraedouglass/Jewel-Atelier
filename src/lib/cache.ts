import type * as THREE from "three";

/** A small least-recently-used cache: once full, adding a key drops the entry used longest ago (calling `onEvict`). */
export class LRU<K, V> {
  private map = new Map<K, V>();
  constructor(private max: number, private onEvict?: (v: V, k: K) => void) {}
  get size() { return this.map.size; }
  has(k: K) { return this.map.has(k); }
  get(k: K): V | undefined {
    if (!this.map.has(k)) return undefined;
    const v = this.map.get(k) as V;
    this.map.delete(k); this.map.set(k, v);
    return v;
  }
  set(k: K, v: V) {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.max) {
      const [oldK, oldV] = this.map.entries().next().value as [K, V];
      this.map.delete(oldK);
      this.onEvict?.(oldV, oldK);
    }
    return this;
  }
  clear() { this.map.clear(); }
}

/**
 * A cache of geometries shared between builds. Shared geometries are marked so disposing one built piece doesn't free
 * buffers the next piece is drawing with; they are disposed only when they fall out of the cache.
 */
export function geometryCache(max: number) {
  const cache = new LRU<string, THREE.BufferGeometry>(max, (g) => g.dispose());
  return (key: string, make: () => THREE.BufferGeometry) => {
    const hit = cache.get(key);
    if (hit) return hit;
    const g = make();
    g.userData.shared = true;
    cache.set(key, g);
    return g;
  };
}

/** true for a geometry owned by a shared cache (see geometryCache) */
export const isShared = (g: THREE.BufferGeometry) => g.userData.shared === true;
