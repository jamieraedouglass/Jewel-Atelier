/**
 * Gallery pictures are taken once and kept. When the look of the 3D view changes (lighting, backdrop, materials),
 * older pictures stop matching newer ones, so each picture's file name carries the look it was taken with and a
 * card whose picture is out of date draws a fresh one. Raise RENDER_VERSION whenever the look changes noticeably.
 */
export const RENDER_VERSION = 5;

export const thumbPath = (userId: string, designId: string) => `${userId}/${designId}-r${RENDER_VERSION}.jpg`;

/** whether a saved picture was taken with the current look */
export const isCurrentThumb = (path: string | null | undefined) => !!path && path.endsWith(`-r${RENDER_VERSION}.jpg`);
