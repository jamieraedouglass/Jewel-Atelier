/**
 * A stone's character beyond its kind and colour: a diamond's colour grade (how white, or how yellow), how included it
 * is, and optical effects such as a star sapphire's star or a cat's-eye band. Read from uploaded photos or set by hand;
 * the 3D model shows them, and the workshop sheet lists them.
 */

/** diamond colour, in the bands a jeweller would use; each sets the stone's tint */
export const DIAMOND_GRADES = [
  { id: "D-F", name: "D–F colourless", color: "#f4f6fb" },
  { id: "G-J", name: "G–J near colourless", color: "#f7f5ee" },
  { id: "K-M", name: "K–M faint yellow", color: "#fbf1d6" },
  { id: "N-R", name: "N–R very light yellow", color: "#f8e8bc" },
  { id: "S-Z", name: "S–Z light yellow", color: "#f3dc9c" },
] as const;
export type DiamondGrade = (typeof DIAMOND_GRADES)[number]["id"];
export const DIAMOND_GRADE_IDS = DIAMOND_GRADES.map((g) => g.id) as unknown as readonly [DiamondGrade, ...DiamondGrade[]];
export const diamondGrade = (id: string | null | undefined) => DIAMOND_GRADES.find((g) => g.id === id) ?? null;

/** optical effects: a star (asterism) or a single bright band (chatoyancy); both need a cabochon */
export const PHENOMENA = ["none", "star", "cats-eye"] as const;
export type Phenomenon = (typeof PHENOMENA)[number];
export const STAR_RAYS = [4, 6, 12] as const;

/** how included a stone looks, in words (0 = eye-clean, 1 = heavily included) */
export function inclusionWords(n: number): string {
  if (n < 0.08) return "eye-clean";
  if (n < 0.35) return "lightly included";
  if (n < 0.65) return "included";
  return "heavily included";
}

type Character = { gem: string; inclusions: number; phenomenon: Phenomenon; rays: number; colorGrade: string | null };

/** the effect, as part of a stone's name: "6-ray star", "cat's-eye" (nothing for a cat's eye gem, which says it already) */
export function phenomenonText(c: Pick<Character, "gem" | "phenomenon" | "rays">): string {
  if (c.phenomenon === "star") return `${c.rays}-ray star`;
  if (c.phenomenon === "cats-eye" && c.gem !== "cats-eye") return "cat's-eye";
  return "";
}

/** the character notes for a spec sheet or a description */
export function characterNotes(c: Character): string[] {
  const out: string[] = [];
  const grade = diamondGrade(c.colorGrade);
  if (grade) out.push(`Colour ${grade.name}`);
  if (c.inclusions >= 0.08) out.push(`${inclusionWords(c.inclusions)[0].toUpperCase()}${inclusionWords(c.inclusions).slice(1)}`);
  const effect = phenomenonText(c);
  if (effect) out.push(effect === "cat's-eye" ? "Cat's-eye band" : `${effect[0].toUpperCase()}${effect.slice(1)}`);
  return out;
}

/** how far a near-colourless stone's colour is from pure white (0–1) */
export function chroma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}
