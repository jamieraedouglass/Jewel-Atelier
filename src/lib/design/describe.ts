import { type Gem } from "./vocab";
import { TYPE_LABEL, accentsOff, isSolidBracelet, styleMeta } from "./styles";
import { type CenterStone, type Design } from "./schema";
import { indianRingSize, label, metalName } from "./measures";
import { phenomenonText } from "./character";

/** Plain-language descriptions of a design, for captions, sharing and Claude. */

const gemName = (g: Gem) => (g === "cats-eye" ? "cat's eye" : label(g).toLowerCase());

export function stoneText(c: CenterStone) {
  if (c.none) return "no main stone";
  const cut = c.cut === "faceted" ? `${c.shape}-cut` : c.cut;
  const effect = phenomenonText(c);
  return `${c.carat ? `${c.carat} ct ` : ""}${effect ? `${effect} ` : ""}${gemName(c.gem)} ${cut} (${Math.round(c.lengthMm * 10) / 10} × ${Math.round(c.widthMm * 10) / 10} mm)`;
}

export function describeDesign(d: Design): string {
  const m = styleMeta(d.type, d.style);
  const o = d.options;
  const parts: (string | null)[] = [`${m.label}${d.type === "ring" || d.type === "earrings" || d.type === "necklace" ? ` ${TYPE_LABEL[d.type].toLowerCase()}` : ""}`];
  if (m.uses.includes("center")) parts.push(stoneText(d.center));
  if (m.uses.includes("sides") && d.sides.kind !== "none") parts.push(`${label(d.sides.kind)} sides ~${d.sides.sizeCt} ct`);
  if ((m.uses.includes("accents") || (m.uses.includes("halo") && o.halo)) && !accentsOff(d)) parts.push(`${gemName(d.accents.gem)} accents ~${d.accents.sizeCt} ct`);
  if (m.uses.includes("fringe") && d.fringe.enabled) parts.push(`${gemName(d.fringe.gem)} ${d.fringe.sizeMm} mm fringe`);
  if (m.uses.includes("enamel") && d.enamel.enabled) parts.push("meenakari enamel");
  if (m.uses.includes("length")) parts.push(`${o.lengthIn}"`);
  if (m.uses.includes("layers") && o.layers > 1) parts.push(`${o.layers} rows`);
  if (d.type === "ring") parts.push(`US ${d.ringSize} / Indian ${indianRingSize(d.ringSize)}`);
  if (m.uses.includes("wrist") && isSolidBracelet(d)) parts.push(`size ${o.bangleSize}`);
  parts.push(metalName(d));
  return parts.filter(Boolean).join(" · ");
}

/** a gem's name for a label or menu: "Cat's eye", "Yellow sapphire" */
export const gemLabel = (g: string) => (g === "cats-eye" ? "Cat's eye" : label(g));
