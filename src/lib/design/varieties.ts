import type { Gem } from "./vocab";

export type Variety = { id: string; name: string; blurb: string; color: string; clarity: number; glow: number };

export const GEM_VARIETIES: Partial<Record<Gem, Variety[]>> = {
  emerald: [
    { id: "colombian", name: "Colombian", blurb: "Pure, vivid green with a touch of blue; lively, almost glowing", color: "#0a9a5c", clarity: 0.5, glow: 0.35 },
    { id: "zambian", name: "Zambian", blurb: "Deeper, cooler bluish green; clean and dark", color: "#0b6a57", clarity: 0.6, glow: 0.05 },
    { id: "panjshir", name: "Panjshir", blurb: "Bright, saturated green close to Colombian", color: "#079163", clarity: 0.55, glow: 0.25 },
    { id: "brazilian", name: "Brazilian", blurb: "Lighter, slightly yellowish green", color: "#3c9a4c", clarity: 0.6, glow: 0.05 },
  ],
  ruby: [
    { id: "burmese", name: "Burmese (pigeon's blood)", blurb: "Vivid pure red that glows from within (strong red fluorescence)", color: "#cc0f2f", clarity: 0.5, glow: 0.7 },
    { id: "mozambique", name: "Mozambique", blurb: "Bright red, lively, a little less glow than Burmese", color: "#c41b2b", clarity: 0.55, glow: 0.4 },
    { id: "thai", name: "Thai / Cambodian", blurb: "Darker, garnet-like red; iron quietens the glow", color: "#7c0b1f", clarity: 0.45, glow: 0 },
    { id: "pink-red", name: "Pinkish red", blurb: "Lighter red leaning pink", color: "#d42a55", clarity: 0.55, glow: 0.3 },
  ],
  sapphire: [
    { id: "kashmir", name: "Kashmir (cornflower)", blurb: "Soft velvety blue from fine silk; glows gently", color: "#2a4cbd", clarity: 0.35, glow: 0.2 },
    { id: "burmese", name: "Burmese (royal blue)", blurb: "Deep, saturated royal blue", color: "#132e9e", clarity: 0.45, glow: 0.1 },
    { id: "ceylon", name: "Ceylon", blurb: "Lighter, brighter blue, very transparent", color: "#4a72d8", clarity: 0.7, glow: 0.05 },
    { id: "australian", name: "Australian", blurb: "Very dark, inky blue", color: "#0c1a52", clarity: 0.35, glow: 0 },
  ],
  spinel: [
    { id: "burmese", name: "Burmese red", blurb: "Clear vivid red that glows", color: "#d0163f", clarity: 0.65, glow: 0.55 },
    { id: "mahenge", name: "Mahenge pink", blurb: "Neon hot pink, intensely fluorescent", color: "#ec2f7c", clarity: 0.7, glow: 0.75 },
  ],
};

export const varietiesOf = (gem: Gem): Variety[] => GEM_VARIETIES[gem] ?? [];

export const matchingVariety = (gem: Gem, s: { color: string; glow: number }) =>
  varietiesOf(gem).find((v) => v.color.toLowerCase() === s.color.toLowerCase() && v.glow === s.glow);

export const varietyLook = (v: Variety) => ({ color: v.color, clarity: v.clarity, glow: v.glow });
