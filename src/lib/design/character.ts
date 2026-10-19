export const DIAMOND_GRADES = [
  { id: "D-F", name: "D–F colourless", color: "#f4f6fb" },
  { id: "G-J", name: "G–J near colourless", color: "#f7f5ee" },
  { id: "K-M", name: "K–M faint yellow", color: "#fbf1d6" },
  { id: "N-R", name: "N–R very light yellow", color: "#f8e8bc" },
  { id: "S-Z", name: "S–Z light yellow", color: "#f3dc9c" },
] as const;
type DiamondGrade = (typeof DIAMOND_GRADES)[number]["id"];
export const DIAMOND_GRADE_IDS = DIAMOND_GRADES.map((g) => g.id) as unknown as readonly [DiamondGrade, ...DiamondGrade[]];
export const diamondGrade = (id: string | null | undefined) => DIAMOND_GRADES.find((g) => g.id === id) ?? null;

export const PHENOMENA = ["none", "star", "cats-eye"] as const;
type Phenomenon = (typeof PHENOMENA)[number];
export const STAR_RAYS = [4, 6, 12] as const;

export const NO_CHARACTER = { colorGrade: null, inclusions: 0, phenomenon: "none" } as const;

export function inclusionWords(n: number): string {
  if (n < 0.08) return "eye-clean";
  if (n < 0.35) return "lightly included";
  if (n < 0.65) return "included";
  return "heavily included";
}

type Character = { gem: string; cut?: string; inclusions: number; phenomenon: Phenomenon; rays: number; colorGrade: string | null };

export const shownPhenomenon = (c: { phenomenon: Phenomenon; cut?: string }): Phenomenon =>
  c.cut === undefined || c.cut === "cabochon" || c.cut === "carved" ? c.phenomenon : "none";

export function phenomenonText(c: Pick<Character, "gem" | "phenomenon" | "rays"> & { cut?: string }): string {
  const p = shownPhenomenon(c);
  if (p === "star") return `${c.rays}-ray star`;
  if (p === "cats-eye" && c.gem !== "cats-eye") return "cat's-eye";
  return "";
}

export function characterNotes(c: Character): string[] {
  const out: string[] = [];
  const grade = diamondGrade(c.colorGrade);
  if (grade) out.push(`Colour ${grade.name}`);
  if (c.inclusions >= 0.08) out.push(`${inclusionWords(c.inclusions)[0].toUpperCase()}${inclusionWords(c.inclusions).slice(1)}`);
  const effect = phenomenonText(c);
  if (effect) out.push(effect === "cat's-eye" ? "Cat's-eye band" : `${effect[0].toUpperCase()}${effect.slice(1)}`);
  return out;
}

export function chroma(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}
