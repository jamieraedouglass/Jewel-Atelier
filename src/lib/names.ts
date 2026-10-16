/**
 * Name-only accounts: each name maps to one account through a slug ("Carl Mehta", "carl  mehta" → "carl-mehta")
 * and a hidden email built from it. Kept in one place so sign-in and the studio admin list always agree.
 */
export const slugify = (name: string) => name.trim().toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
export const NAME_EMAIL_DOMAIN = "users.jewel-atelier.invalid";
export const emailForName = (name: string) => `${slugify(name)}@${NAME_EMAIL_DOMAIN}`;
