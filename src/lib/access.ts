/**
 * On a private studio, what someone who isn't signed in may open: the sign-in page, the client links (and the API
 * behind them), and the demo. Everything else sends them to sign in.
 */
const OPEN = [/^\/login(\/|$)/, /^\/auth\//, /^\/c\/[^/]+\/?$/, /^\/api\/client\//, /^\/demo(\/|$)/];

export const isOpenPath = (path: string) => OPEN.some((r) => r.test(path));
