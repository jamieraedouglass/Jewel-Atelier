const OPEN = [/^\/login(\/|$)/, /^\/auth\//, /^\/c\/[^/]+\/?$/, /^\/api\/client\//, /^\/demo(\/|$)/];

export const isOpenPath = (path: string) => OPEN.some((r) => r.test(path));
