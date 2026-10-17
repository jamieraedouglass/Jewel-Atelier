export const RENDER_VERSION = 5;

export const thumbPath = (userId: string, designId: string) => `${userId}/${designId}-r${RENDER_VERSION}.jpg`;

export const isCurrentThumb = (path: string | null | undefined) => !!path && path.endsWith(`-r${RENDER_VERSION}.jpg`);
