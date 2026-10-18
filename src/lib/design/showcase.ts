import { varietiesOf, varietyLook } from "./varieties";
import { GEM_LOOK, type Gem } from "./vocab";
import { type PieceType } from "./styles";
import { type CenterStone, type Design, defaultDesign } from "./schema";
import { DROP_PRESETS, FRAME_PRESETS, KOTHARI } from "./presets";
import { type DesignPatch, applyPatch, chooseStyle } from "./edit";
import { estimateDims } from "./measures";

const diamond = (shape: CenterStone["shape"], ct: number, name: string, cut: CenterStone["cut"] = "faceted"): Partial<CenterStone> => ({
  gem: "diamond", cut, shape, carat: ct, ...estimateDims("diamond", cut, shape, ct), color: "#f4f6fb", clarity: 0.95, label: name, photoPath: null,
});
const gem = (g: Gem, cut: CenterStone["cut"], shape: CenterStone["shape"], ct: number, name: string): Partial<CenterStone> => ({
  gem: g, cut, shape, carat: ct, ...estimateDims(g, cut, shape, ct), ...GEM_LOOK[g], label: name, photoPath: null,
});

const graded = (g: Gem, id: string) => {
  const v = varietiesOf(g).find((x) => x.id === id);
  if (!v) throw new Error(`no ${id} grade for ${g}`);
  return varietyLook(v);
};

const RAINBOW_OMBRE = ["#f2a6c4", "#e58fb8", "#c99be0", "#a7a9e8", "#c7d3ee", "#f4eec0", "#f2d66a", "#f2b23a", "#ec8a2c", "#f2b23a", "#f2d66a", "#f4eec0", "#c7d3ee", "#a7a9e8", "#c99be0", "#e58fb8"];
const RAINBOW_WITH_DIAMONDS = ["#e2581c", "#f08a1e", "#f2b81e", "#d8c63a", "#8fb87a", "#6f8fb8", "#8a6fc0", "#d06aa0"].flatMap((c) => [c, "#f4f6fb", "#f4f6fb"]);

const dropOf = (name: string) => { const p = DROP_PRESETS.find((x) => x.name === name); if (!p) throw new Error(`no drop preset ${name}`); return { parts: p.parts }; };
const framesOf = (name: string) => { const p = FRAME_PRESETS.find((x) => x.name === name); if (!p) throw new Error(`no frame preset ${name}`); return p; };
const graded3 = (g: Gem, id: string, cut: CenterStone["cut"], shape: CenterStone["shape"], ct: number, name: string) => ({ ...gem(g, cut, shape, ct, name), ...graded(g, id) });

export const SHOWCASE: { name: string; type: PieceType; style: string; patch: DesignPatch; collection?: string }[] = [
  { name: "Burmese sapphire, half-moons", type: "ring", style: "three-stone", patch: { metal: "white-gold", center: { gem: "sapphire", cut: "cabochon", shape: "oval", carat: 15.24, lengthMm: 15, widthMm: 12, domeMm: 5.4, color: "#0c2394", clarity: 0.3, label: "Royal blue sapphire cabochon", rotation: 0, none: false }, sides: { kind: "half-moon", hug: true } } },
  { name: "Polki bridal jhumkas", type: "earrings", style: "jhumka", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: diamond("round", 1, "Polki diamond", "polki"), accents: { gem: "ruby", color: GEM_LOOK.ruby.color, sizeCt: 0.08 }, enamel: { enabled: true, color: "#16704c" } } },
  { name: "Emerald chandbalis", type: "earrings", style: "chandbali", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: gem("emerald", "cabochon", "pear", 3, "Emerald drop"), accents: { gem: "diamond", cut: "polki", color: "#f4f6fb", sizeCt: 0.06 } } },
  { name: "Kundan choker", type: "necklace", style: "kundan-choker", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: diamond("cushion", 1.5, "Polki diamond", "polki"), enamel: { enabled: true, color: "#9b1630" } } },
  { name: "Rani haar with emerald", type: "necklace", style: "rani-haar", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: gem("emerald", "cabochon", "oval", 20, "Carved-look emerald"), fringe: { enabled: true, gem: "pearl", color: GEM_LOOK.pearl.color, sizeMm: 5 } } },
  { name: "Temple coin necklace", type: "necklace", style: "temple", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: gem("ruby", "cabochon", "oval", 3, "Ruby cabochon") } },
  { name: "Diamond riviera", type: "necklace", style: "riviera", patch: { metal: "white-gold", center: diamond("round", 0.5, "Round brilliant diamond") } },
  { name: "Polki kada", type: "bracelet", style: "kada", patch: { metal: "yellow-gold", purity: { karat: 22 }, accents: { gem: "diamond", cut: "polki", color: "#f4f6fb", sizeCt: 0.15 }, enamel: { enabled: true, color: "#1b3f8f" } } },
  { name: "Diamond tennis bracelet", type: "bracelet", style: "tennis", patch: { metal: "white-gold", accents: { gem: "diamond", cut: "faceted", color: "#f4f6fb", sizeCt: 0.1 } } },
  { name: "Bridal maang tikka", type: "headpiece", style: "maang-tikka", patch: { metal: "yellow-gold", purity: { karat: 22 }, center: diamond("pear", 1.5, "Polki diamond", "polki"), accents: { gem: "emerald", color: GEM_LOOK.emerald.color, sizeCt: 0.05 } } },
  { name: "Bridal nath", type: "nose", style: "nath", patch: { metal: "yellow-gold", purity: { karat: 22 }, accents: { gem: "ruby", color: GEM_LOOK.ruby.color, sizeCt: 0.03 } } },
  { name: "Ghungroo payal", type: "anklet", style: "payal", patch: { metal: "oxidised-silver" } },
  { name: "Hexagon ruby Deco ring", type: "ring", style: "deco", patch: { metal: "platinum", center: diamond("old-mine", 1.5, "Old-mine diamond"), frames: FRAME_PRESETS[0].frames } as DesignPatch },
  { name: "Ballerina ring", type: "ring", style: "deco", patch: { metal: "yellow-gold", center: diamond("round", 1, "Round brilliant"), frames: FRAME_PRESETS[6].frames } as DesignPatch },
  { name: "Sapphire petal ring", type: "ring", style: "deco", patch: { metal: "platinum", center: diamond("cushion", 2, "Old cushion diamond"), frames: FRAME_PRESETS[4].frames } as DesignPatch },
  { name: "Marquise mosaic cocktail ring", type: "ring", style: "deco", patch: { metal: "yellow-gold", center: diamond("marquise", 2.5, "Marquise diamond"), frames: FRAME_PRESETS[8].frames, options: { decoDome: 0.8, decoWrap: true }, band: { widthMm: 6, pave: "full", paveRows: 2, paveGem: "emerald", paveColor: GEM_LOOK.emerald.color, paveShape: "marquise", paveMm: 1.8, paveAngle: 35 } } as DesignPatch },
  { name: "Pavé swirl ring", type: "ring", style: "swirl", patch: { metal: "white-gold", center: diamond("round", 1.2, "Round brilliant"), options: { count: 3 }, accents: { sizeCt: 0.012 } } },
  { name: "Oval trilogy ring", type: "ring", style: "three-stone", patch: { metal: "platinum", center: diamond("oval", 2, "Oval diamond"), sides: { kind: "oval", sizeCt: 0.6 } } },
  { name: "Old-mine and baguette line bracelet", type: "bracelet", style: "tennis", patch: { metal: "platinum", accents: { shapes: ["old-mine", "baguette"], turns: [0, 90], sizeCt: 1.2 } } },
  { name: "Round and twin-baguette bracelet", type: "bracelet", style: "tennis", patch: { metal: "platinum", accents: { shapes: ["round", "baguette"], turns: [0, 0], twins: [false, true], sizeCt: 1.5 } } },
  { name: "Three-row oval halo bracelet", type: "bracelet", style: "tennis", patch: { metal: "white-gold", accents: { shapes: ["oval"], sizeCt: 0.5 }, options: { layers: 3, halo: true } } },
  { name: "Shield diamond open bangle", type: "bracelet", style: "open-bangle", patch: { metal: "yellow-gold", options: { pave: true }, accents: { shapes: ["baguette"], orientation: "across", sizeCt: 0.08 } } },
  { name: "Rose-cut diamonds by the yard", type: "necklace", style: "by-the-yard", patch: { metal: "yellow-gold" } },
  { name: "Gold X-link collar", type: "necklace", style: "gold-collar", patch: { metal: "yellow-gold", options: { linkStyle: "x" } } },
  { name: "Ruby chevron collar", type: "necklace", style: "gold-collar", patch: { metal: "yellow-gold", options: { linkStyle: "chevron" }, accents: { gem: "ruby", color: GEM_LOOK.ruby.color, sizeCt: 0.015 } } },
  { name: "Pink oval with hugging half-moons", type: "ring", style: "three-stone", patch: { metal: "platinum", center: { gem: "diamond", cut: "faceted", shape: "oval", lengthMm: 13, widthMm: 9.5, domeMm: 1.6, color: "#f2a6bf", clarity: 0.9, label: "Pink oval diamond", carat: null, rotation: 0 }, sides: { kind: "half-moon", hug: true, hugFrac: 0.8 } } },
  { name: "Round and baguette line necklace", type: "necklace", style: "line", patch: { metal: "platinum" } },
  { name: "Round and baguette line bracelet", type: "bracelet", style: "tennis", patch: { metal: "platinum", accents: { shapes: ["round", "round", "baguette", "round"], sizes: [2, 1, 1.2, 1], turns: [0, 0, 0, 0], sizeCt: 0.2 } } },
  { name: "Gold band with diamond edges", type: "ring", style: "wide-band", patch: { metal: "white-gold", band: { widthMm: 7.5 }, options: { layers: 2, halo: true } } },
  { name: "Three-diamond pendant", type: "necklace", style: "three-stone-pendant", patch: { metal: "white-gold" } },
  { name: "Yellow heart with a marquise vine", type: "ring", style: "solitaire", patch: { metal: "yellow-gold", center: { gem: "yellow-sapphire", cut: "faceted", shape: "heart", lengthMm: 9, widthMm: 9, domeMm: 1.4, color: "#f2c230", clarity: 0.75, label: "Yellow heart", carat: null, rotation: 0, none: false }, band: { pave: "half", paveShape: "marquise", paveMm: 1.6, paveAngle: 40, paveRows: 1 } } },
  { name: "Diamond flower posy ring", type: "ring", style: "posy", patch: { metal: "white-gold", options: { count: 9, pave: true } } },
  { name: "Two-stone with a baguette surround", type: "ring", style: "two-stone", patch: { metal: "platinum", options: { halo: true }, accents: { shapes: ["baguette"], orientation: "along", sizeCt: 0.05 } } },
  { name: "Gold flower posy studs", type: "earrings", style: "flowers", patch: { metal: "yellow-gold", purity: { karat: 22 } } },
  { name: "Burmese ruby halo ring", type: "ring", style: "halo", patch: { metal: "platinum", center: { ...gem("ruby", "faceted", "oval", 2, "Burmese (pigeon's blood) ruby"), ...graded("ruby", "burmese") } } },
  { name: "Colombian emerald solitaire", type: "ring", style: "solitaire", patch: { metal: "yellow-gold", center: { ...gem("emerald", "faceted", "emerald", 2.5, "Colombian emerald"), ...graded("emerald", "colombian") } } },
  { name: "Half-flowered Burmese ruby ring", collection: KOTHARI, type: "ring", style: "half-flower", patch: { metal: "yellow-gold", center: graded3("ruby", "burmese", "faceted", "cushion", 5, "Burmese ruby (pigeon's blood)"), options: { count: 5 } } },
  { name: "Half-flowered emerald ring", collection: KOTHARI, type: "ring", style: "half-flower", patch: { metal: "platinum", center: graded3("emerald", "colombian", "faceted", "emerald", 6, "Colombian emerald"), options: { count: 5 } } },
  { name: "Emerald with a briolette halo", collection: KOTHARI, type: "ring", style: "deco", patch: { metal: "yellow-gold", center: { ...framesOf("Briolette halo").center, carat: null, rotation: 0, none: false }, frames: framesOf("Briolette halo").frames } as DesignPatch },
  { name: "Emerald in pear-diamond petals ring", collection: KOTHARI, type: "ring", style: "deco", patch: { metal: "platinum", center: { ...framesOf("Emerald in pear-diamond petals").center, carat: null, rotation: 0, none: false }, frames: framesOf("Emerald in pear-diamond petals").frames } as DesignPatch },
  { name: "Ten-carat round solitaire", collection: KOTHARI, type: "ring", style: "solitaire", patch: { metal: "platinum", center: diamond("round", 10, "10 ct round brilliant"), setting: { style: "six-claw" } } },
  { name: "Kashi Kamal earrings", collection: KOTHARI, type: "earrings", style: "pendant", patch: { metal: "yellow-gold", drop: { ...dropOf("Kashi Kamal"), top: "post" } } as DesignPatch },
  { name: "Ruby, emerald bead and pearl earrings", collection: KOTHARI, type: "earrings", style: "pendant", patch: { metal: "yellow-gold", drop: { ...dropOf("Ruby, emerald bead and pearl drop"), top: "post" } } as DesignPatch },
  { name: "Burmese ruby cluster chandeliers", collection: KOTHARI, type: "earrings", style: "chandelier", patch: { metal: "platinum", drop: { ...dropOf("Burmese ruby cluster chandelier"), top: "post" } } as DesignPatch },
  { name: "Pear diamond cascade earrings", collection: KOTHARI, type: "earrings", style: "chandelier", patch: { metal: "platinum", drop: { ...dropOf("Pear diamond cascade"), top: "post" } } as DesignPatch },
  { name: "Ruby and diamond leaf earrings", collection: KOTHARI, type: "earrings", style: "pendant", patch: { metal: "platinum", drop: { ...dropOf("Ruby and diamond leaf drop"), top: "post" } } as DesignPatch },
  { name: "Kite flower studs", collection: KOTHARI, type: "earrings", style: "pendant", patch: { metal: "platinum", drop: { ...dropOf("Kite flower stud"), top: "post" } } as DesignPatch },
  { name: "Emerald ribbon flower studs", collection: KOTHARI, type: "earrings", style: "pendant", patch: { metal: "platinum", drop: { ...dropOf("Emerald ribbon flower"), top: "post" } } as DesignPatch },
  { name: "Old-cut diamond huggie drops", collection: KOTHARI, type: "earrings", style: "hoop", patch: { metal: "platinum", center: diamond("old-mine", 3, "Old-mine diamond"), options: { hoopDiameterMm: 13, pave: true, paveCoverage: "front", hoopShape: "round" } } },
  { name: "Burmese ruby riviera", collection: KOTHARI, type: "necklace", style: "riviera", patch: { metal: "platinum", center: graded3("ruby", "burmese", "faceted", "oval", 1.5, "Burmese rubies") } },
  { name: "Emerald bead choker", collection: KOTHARI, type: "necklace", style: "pearl-strand", patch: { metal: "yellow-gold", purity: { karat: 22 }, fringe: { enabled: true, gem: "emerald", color: "#0a9a5c", sizeMm: 6 }, options: { layers: 4, lengthIn: 15 } } },
  { name: "Emerald bead tassel pendant", collection: KOTHARI, type: "necklace", style: "drop-pendant", patch: { metal: "yellow-gold", drop: dropOf("Emerald bead tassel"), options: { lengthIn: 30, chain: "fine" } } as DesignPatch },
  { name: "Five-row briolette fringe necklace", collection: KOTHARI, type: "necklace", style: "briolette-fringe", patch: { metal: "platinum" } },
  { name: "Emerald-cut emerald line necklace", collection: KOTHARI, type: "necklace", style: "line", patch: { metal: "platinum", accents: { gem: "emerald", color: "#0a9a5c", glow: 0.35, shapes: ["emerald", "round", "round"], colors: ["#0a9a5c", "#f4f6fb", "#f4f6fb"], sizeCt: 0.6 } } as DesignPatch },
  { name: "Three-row diamond bracelet", collection: KOTHARI, type: "bracelet", style: "tennis", patch: { metal: "platinum", accents: { shapes: ["round"], sizeCt: 0.25 }, options: { layers: 3 } } as DesignPatch },
  { name: "Burmese ruby halo bracelet", collection: KOTHARI, type: "bracelet", style: "tennis", patch: { metal: "platinum", accents: { gem: "ruby", ...graded("ruby", "burmese"), shapes: ["oval"], sizeCt: 0.6 }, options: { layers: 1, halo: true } } as DesignPatch },
  { name: "Pear emerald tiara", collection: KOTHARI, type: "headpiece", style: "tiara", patch: { metal: "platinum" } },
  { name: "Sugarloaf emerald cufflinks", collection: KOTHARI, type: "mens", style: "cufflinks", patch: { metal: "yellow-gold" } },
  { name: "Calibré emerald sherwani buttons", collection: KOTHARI, type: "mens", style: "sherwani-buttons", patch: { metal: "yellow-gold", purity: { karat: 22 } } },
  { name: "Rainbow sapphire line necklace", collection: KOTHARI, type: "necklace", style: "line", patch: { metal: "yellow-gold", accents: { gem: "sapphire", shapes: ["emerald"], orientation: "along", sizeCt: 0.35, colors: RAINBOW_OMBRE }, options: { lengthIn: 16 } } as DesignPatch },
  { name: "Rainbow sapphire line drops", collection: KOTHARI, type: "earrings", style: "pendant", patch: { metal: "yellow-gold", drop: { ...dropOf("Rainbow sapphire line drop"), top: "post" } } as DesignPatch },
  { name: "Rainbow sapphire eternity band", collection: KOTHARI, type: "ring", style: "eternity", patch: { metal: "yellow-gold", band: { widthMm: 4.5 }, accents: { gem: "sapphire", shapes: ["oval", "round", "round"], orientation: "along", turns: [], twins: [], sizes: [1.9, 0.8, 0.8], sizeCt: 0.12, colors: RAINBOW_WITH_DIAMONDS } } as DesignPatch },
  { name: "Matched Asscher studs", collection: KOTHARI, type: "earrings", style: "stud", patch: { metal: "platinum", center: diamond("asscher", 3, "Asscher-cut diamond"), setting: { style: "four-claw" } } },
  { name: "Carved aquamarine and golden pearl pendant", collection: KOTHARI, type: "necklace", style: "drop-pendant", patch: { metal: "yellow-gold", drop: dropOf("Carved stone pendant"), options: { lengthIn: 22, chain: "fine" } } as DesignPatch },
  { name: "Mughal carved emerald ring", collection: KOTHARI, type: "ring", style: "solitaire", patch: { metal: "yellow-gold", purity: { karat: 22 }, setting: { style: "four-claw" }, center: { gem: "emerald", cut: "carved", shape: "cushion", lengthMm: 16, widthMm: 13, domeMm: 4.5, ...graded("emerald", "colombian"), label: "Carved Colombian emerald", carat: null, rotation: 0, none: false } } },
  { name: "Carved jade drops", collection: KOTHARI, type: "earrings", style: "pendant", patch: { metal: "yellow-gold", purity: { karat: 22 }, drop: { ...dropOf("Carved jade drop"), top: "post" } } as DesignPatch },
];

export type ShowcasePiece = (typeof SHOWCASE)[number];

export function showcaseDesign(entry: ShowcasePiece, current?: Design): Design {
  const fresh = current
    ? applyPatch(defaultDesign(), { ringSize: current.ringSize, options: { wristCm: current.options.wristCm, bangleSize: current.options.bangleSize } })
    : defaultDesign();
  return { ...applyPatch(chooseStyle(fresh, entry.type, entry.style), entry.patch), name: entry.name };
}

export const SHOWCASE_CATEGORIES = [
  { id: "kothari", label: "Kothari's", has: (s: ShowcasePiece) => s.collection === KOTHARI },
  { id: "ring", label: "Rings", has: (s: ShowcasePiece) => s.type === "ring" },
  { id: "earrings", label: "Earrings", has: (s: ShowcasePiece) => s.type === "earrings" },
  { id: "necklace", label: "Necklaces", has: (s: ShowcasePiece) => s.type === "necklace" },
  { id: "bracelet", label: "Bracelets", has: (s: ShowcasePiece) => s.type === "bracelet" },
  { id: "more", label: "More", has: (s: ShowcasePiece) => !["ring", "earrings", "necklace", "bracelet"].includes(s.type) },
] as const;
export type ShowcaseCategory = (typeof SHOWCASE_CATEGORIES)[number]["id"];

export const showcaseIn = (category: ShowcaseCategory) => {
  const cat = SHOWCASE_CATEGORIES.find((c) => c.id === category) ?? SHOWCASE_CATEGORIES[0];
  return SHOWCASE.map((entry, index) => ({ entry, index })).filter(({ entry }) => cat.has(entry));
};

export const categoryFor = (type: PieceType): ShowcaseCategory =>
  (SHOWCASE_CATEGORIES.find((c) => c.id === type)?.id ?? "more") as ShowcaseCategory;
