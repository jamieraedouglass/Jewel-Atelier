/**
 * Where to send someone after signing in. Only paths on this site are allowed: "//evil.com" and "/\evil.com" look like
 * paths but browsers treat them as other sites, so they (and anything else odd) fall back to the designer.
 */
export function safeNext(next: unknown, fallback = "/design"): string {
  if (typeof next !== "string" || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\") || /[\u0000-\u001f\\]/.test(next)) return fallback;
  try {
    const u = new URL(next, "http://x.invalid");
    return u.origin === "http://x.invalid" ? `${u.pathname}${u.search}${u.hash}` : fallback;
  } catch {
    return fallback;
  }
}
