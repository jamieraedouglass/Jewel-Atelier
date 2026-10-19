export const slugify = (name: string) => name.trim().toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
const NAME_EMAIL_DOMAIN = "users.jewel-atelier.invalid";
export const emailForName = (name: string) => `${slugify(name)}@${NAME_EMAIL_DOMAIN}`;
// A comma-separated list of people (emails, or names they signed up with) as a set of emails.
export const emailSet = (raw: string) => new Set(raw.split(",").map((x) => x.trim()).filter(Boolean).map((x) => (x.includes("@") ? x.toLowerCase() : emailForName(x))));
