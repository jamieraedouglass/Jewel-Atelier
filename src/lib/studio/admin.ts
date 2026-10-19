import { emailSet } from "../names";

function studioAdminEmails(raw = process.env.STUDIO_ADMINS ?? ""): Set<string> {
  return emailSet(raw);
}

export function isStudioAdmin(user: { email?: string | null } | null | undefined, raw?: string): boolean {
  const email = user?.email?.toLowerCase();
  return !!email && studioAdminEmails(raw).has(email);
}
