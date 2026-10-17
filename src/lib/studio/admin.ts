import { emailForName } from "../names";

export function studioAdminEmails(raw = process.env.STUDIO_ADMINS ?? ""): Set<string> {
  return new Set(raw.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (x.includes("@") ? x.toLowerCase() : emailForName(x))));
}

export function isStudioAdmin(user: { email?: string | null } | null | undefined, raw?: string): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && studioAdminEmails(raw).has(email);
}
