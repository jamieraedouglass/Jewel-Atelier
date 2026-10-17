import { DropPartSchema, type DropPart } from "./schema";

const remap = (list: DropPart[], map: (j: number) => number) => list.map((q) => (q.from >= 0 ? { ...q, from: map(q.from) } : q));

export function moveDropPart(parts: DropPart[], i: number, by: -1 | 1): DropPart[] {
  const j = i + by;
  if (i < 0 || i >= parts.length || j < 0 || j >= parts.length) return parts;
  const n = [...parts];
  const [x] = n.splice(i, 1);
  n.splice(j, 0, x);
  return remap(n, (k) => (k === i ? j : k === j ? i : k)).map((q, k) => (q.from >= k ? { ...q, from: -1 } : q));
}

export function copyDropPart(parts: DropPart[], i: number): DropPart[] {
  if (i < 0 || i >= parts.length) return parts;
  return [...parts.slice(0, i + 1), parts[i], ...remap(parts.slice(i + 1), (j) => (j > i ? j + 1 : j))];
}

export function removeDropPart(parts: DropPart[], i: number): DropPart[] {
  if (i < 0 || i >= parts.length) return parts;
  return remap(parts.filter((_, j) => j !== i), (j) => (j === i ? -1 : j > i ? j - 1 : j));
}

export function updateDropPart(parts: DropPart[], i: number, change: Partial<DropPart>): DropPart[] {
  const r = DropPartSchema.safeParse({ ...parts[i], ...change });
  return r.success ? parts.map((x, j) => (j === i ? r.data : x)) : parts;
}
