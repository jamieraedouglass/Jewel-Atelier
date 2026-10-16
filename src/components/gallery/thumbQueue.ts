import type { Design } from "@/lib/design";

/**
 * Pictures waiting to be drawn by the one shared thumbnail canvas (see ThumbStudio). Browsers allow only about 16
 * WebGL canvases at once, so a gallery can't give every card its own; instead each card asks here and waits its turn.
 */
export type ThumbJob = { id: string; design: Design; resolve: (b: Blob | null) => void };

let queue: ThumbJob[] = [];
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((l) => l());

export const thumbQueue = {
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  /** the job being drawn now */
  current: (): ThumbJob | null => queue[0] ?? null,
  /** ask for a picture of a design; resolves with the picture, or null if it couldn't be drawn or was cancelled */
  request(id: string, design: Design): { picture: Promise<Blob | null>; cancel: () => void } {
    let job!: ThumbJob;
    const picture = new Promise<Blob | null>((resolve) => { job = { id, design, resolve }; });
    queue = [...queue, job];
    changed();
    return { picture, cancel: () => thumbQueue.finish(job, null) };
  },
  /** done with a job (drawn or given up on): hand back its picture and move on to the next */
  finish(job: ThumbJob, blob: Blob | null) {
    if (!queue.includes(job)) return;
    queue = queue.filter((j) => j !== job);
    job.resolve(blob);
    changed();
  },
};
