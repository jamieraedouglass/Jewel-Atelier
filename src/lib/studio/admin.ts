import { emailForName } from "../names";

/**
 * The studio's master accounts (e.g. Carl): they see every account's designs, send designs to clients and read the
 * spec sheets. Set STUDIO_ADMINS to a comma-separated list of the names they sign in with (or emails).
 */
export function studioAdminEmails(raw = process.env.STUDIO_ADMINS ?? ""): Set<string> {
  return new Set(raw.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (x.includes("@") ? x.toLowerCase() : emailForName(x))));
}

export function isStudioAdmin(user: { email?: string | null } | null | undefined, raw?: string): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && studioAdminEmails(raw).has(email);
}
