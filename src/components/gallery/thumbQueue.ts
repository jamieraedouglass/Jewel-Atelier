import type { Design } from "@/lib/design";

type ThumbJob = { id: string; design: Design; resolve: (b: Blob | null) => void };

let queue: ThumbJob[] = [];
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export const thumbQueue = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  current: (): ThumbJob | null => queue[0] ?? null,
  request(id: string, design: Design): { picture: Promise<Blob | null>; cancel: () => void } {
    let job!: ThumbJob;
    const picture = new Promise<Blob | null>((resolve) => { job = { id, design, resolve }; });
    queue = [...queue, job];
    changed();
    return { picture, cancel: () => thumbQueue.finish(job, null) };
  },
  finish(job: ThumbJob, blob: Blob | null) {
    if (!queue.includes(job)) return;
    queue = queue.filter((j) => j !== job);
    job.resolve(blob);
    changed();
  },
};
