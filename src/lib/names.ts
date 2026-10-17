export const slugify = (name: string) => name.trim().toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
export const NAME_EMAIL_DOMAIN = "users.jewel-atelier.invalid";
export const emailForName = (name: string) => `${slugify(name)}@${NAME_EMAIL_DOMAIN}`;
