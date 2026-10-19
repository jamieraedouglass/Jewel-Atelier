import { type Design } from "./schema";
import { type DesignPatch } from "./edit";

export const TYPES = ["ring", "earrings", "necklace", "bracelet", "anklet", "headpiece", "nose", "armlet", "hand", "mens"] as const;
export type PieceType = (typeof TYPES)[number];

export const TYPE_LABEL: Record<PieceType, string> = {
  ring: "Ring", earrings: "Earrings", necklace: "Necklace", bracelet: "Bracelet & bangle", anklet: "Anklet (payal)",
  headpiece: "Maang tikka, matha patti & tiara", nose: "Nath & nose stud", armlet: "Bajuband", hand: "Haathphool",
  mens: "Cufflinks & buttons",
};

export type Use =
  | "center" | "accents" | "fringe" | "enamel" | "setting" | "sides" | "band" | "halo" | "accentTop" | "pave"
  | "hoop" | "length" | "wrist" | "chain" | "count" | "layers" | "motif" | "freeform" | "accentShapes" | "extraStones" | "drop" | "frames" | "links" | "hang" | "clasp";

type StyleMeta = { label: string; blurb: string; uses: Use[]; defaults?: DesignPatch };

const CORE: Use[] = ["center", "setting"];

export const STYLES: Record<PieceType, Record<string, StyleMeta>> = {
  ring: {
    "three-stone": { label: "Three-stone", blurb: "Centre stone with a matched pair of side stones.", uses: [...CORE, "sides", "band"] },
    "two-stone": { label: "Two-stone (toi-et-moi)", blurb: "Two stones side by side, each its own gem, shape, size and angle, with an optional surround of baguettes or pavé.", uses: [...CORE, "extraStones", "halo", "accents", "band"] },
    posy: { label: "Flower posy", blurb: "A cluster of little flowers round the centre, gold or set with diamonds.", uses: [...CORE, "accents", "count", "pave", "band"], defaults: { sides: { kind: "none" }, options: { count: 9, pave: true }, accents: { sizeCt: 0.03 } } },
    solitaire: { label: "Solitaire", blurb: "One stone, nothing competing.", uses: [...CORE, "band"] },
    halo: { label: "Halo", blurb: "A ring of small stones framing the centre.", uses: [...CORE, "accents", "sides", "band"], defaults: { sides: { kind: "none" }, accents: { sizeCt: 0.04 } } },
    cluster: { label: "Cluster", blurb: "Petal stones around the centre, like a flower.", uses: [...CORE, "accents", "band"], defaults: { sides: { kind: "none" }, accents: { sizeCt: 0.4 } } },
    navratna: { label: "Navratna", blurb: "Ruby centre ringed by the eight other planetary gems.", uses: [...CORE, "band"], defaults: { sides: { kind: "none" }, center: { gem: "ruby", cut: "faceted", shape: "round", lengthMm: 7, widthMm: 7, domeMm: 1.2, color: "#b3062a", clarity: 0.45, label: "Ruby" } } },
    "polki-cocktail": { label: "Polki cocktail", blurb: "Big polki centre, double halo with a pearl fringe.", uses: [...CORE, "accents", "fringe", "band"], defaults: { sides: { kind: "none" }, center: { gem: "diamond", cut: "polki", shape: "cushion", lengthMm: 14, widthMm: 12, domeMm: 0.8, color: "#f4f6fb", clarity: 0.9, label: "Polki diamond" }, fringe: { enabled: true } } },
    eternity: { label: "Eternity band", blurb: "Stones all the way round.", uses: ["accents", "band"], defaults: { accents: { sizeCt: 0.1 } } },
    "wide-band": { label: "Wide band with diamond rows", blurb: "A broad band with rows of stones all the way round: on the edges with gold between, or across the whole band.", uses: ["accents", "band", "layers", "halo"], defaults: { band: { widthMm: 7 }, options: { layers: 2, halo: true }, accents: { sizeCt: 0.06 } } },
    deco: { label: "Art Deco / layered halo", blurb: "Centre stone framed by layers: calibré rubies, emeralds or sapphires, baguettes, pavé and milgrain, in round, octagon, hexagon or cushion shapes.", uses: [...CORE, "frames", "band"], defaults: { sides: { kind: "none" }, setting: { style: "bezel" }, band: { profile: "low" } } },
    "half-flower": { label: "Half-flower", blurb: "Half a flower of pear diamonds round a little round, tucked against one end of the centre stone (or both).", uses: [...CORE, "accents", "count", "halo", "band"], defaults: { sides: { kind: "none" }, options: { count: 5, halo: false }, setting: { style: "four-claw" } } },
    swirl: { label: "Swirl / bypass", blurb: "Pavé ribbons sweeping around the centre stone.", uses: [...CORE, "accents", "count", "band"], defaults: { sides: { kind: "none" }, options: { count: 3 }, accents: { sizeCt: 0.012 } } },
    freeform: { label: "Unique piece (describe it or from photos)", blurb: "Any design, drawn by the AI from your description or photos as a sketch you can change, then built: stones in rows and pavé, gold wire, plates and single stones, wrapped over the finger.", uses: ["freeform", "band"],
      defaults: { freeform: { name: "Oval cluster", mirror: false, paths: [{ id: "halo", closed: true, points: [[0, -5.6], [4.6, 0], [0, 5.6], [-4.6, 0]] }], parts: [
        { kind: "stone", at: [0, 0, 0.6], gem: "diamond", color: "#f4f6fb", cut: "faceted", shape: "oval", lengthMm: 8, widthMm: 6, rotation: 0, setting: "claw" },
        { kind: "row", path: "halo", from: 0, to: 1, gem: "diamond", color: "#f4f6fb", cut: "faceted", shape: "round", sizeMm: 1.5, set: "along", rows: 1, gapMm: 0.15 },
      ] } } },
    "motif-ring": { label: "Custom motif", blurb: "Your own shape — described, sketched or from an SVG — as the ring top.", uses: ["motif", "center", "accents", "enamel", "band"] },
  },
  earrings: {
    freeform: { label: "Unique piece (describe it or from photos)", blurb: "Any design, drawn by the AI from your description or photos as a sketch you can change, then built as a pair: drops, clusters, garlands and fringes of stones, gold wire and plates, on a post or a hook.", uses: ["freeform"] },
    deco: { label: "Art Deco / layered halo stud", blurb: "A centre stone framed by layers of calibré stones, baguettes, pavé and milgrain.", uses: [...CORE, "frames"], defaults: { setting: { style: "bezel" } } },
    flowers: { label: "Gold flower cluster", blurb: "A posy of gold flowers, plain or with a diamond in each centre.", uses: ["accents", "count", "pave"], defaults: { options: { count: 7, pave: false }, metal: "yellow-gold" } },
    stud: { label: "Stud", blurb: "One stone, or several in a row (toi-et-moi, clusters), each in its own shape, gem and angle.", uses: [...CORE, "halo", "accents", "extraStones"] },
    drop: { label: "Drop", blurb: "The stone hangs below a small top stone.", uses: [...CORE, "accentTop", "accents"] },
    hoop: { label: "Hoop", blurb: "Round, oval or paperclip hoop, plain or pavé, with an optional pearl cluster and charm.", uses: [...CORE, "hoop", "pave", "accents", "fringe"] },
    huggie: { label: "Huggie", blurb: "Small, thick hoop that hugs the lobe.", uses: ["accents", "pave"], defaults: { options: { hoopDiameterMm: 12, pave: true } } },
    chandelier: { label: "Chandelier", blurb: "Built part by part: fleur tops, clusters, sprays, strands, frames and drops.", uses: ["drop"] },
    pendant: { label: "Pendant drop (build your own)", blurb: "Stack stones, clusters, frames, bows and fringes into any drop or stud.", uses: ["drop"] },
    jhumka: { label: "Jhumka", blurb: "Kundan top with a bell below and a pearl fringe.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
    chandbali: { label: "Chandbali", blurb: "Crescent moon set with stones, fringed with pearls.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
    climber: { label: "Ear climber", blurb: "Graduated line of stones climbing the ear.", uses: ["accents", "count"], defaults: { options: { count: 7 } } },
    tassel: { label: "Tassel", blurb: "Stud top with strands of beads swinging below.", uses: [...CORE, "fringe", "count"], defaults: { fringe: { enabled: true }, options: { count: 5 } } },
    motif: { label: "Custom motif", blurb: "Your own shape hanging from a small stud.", uses: ["motif", "center", "accents", "enamel", "fringe"] },
  },
  necklace: {
    pendant: { label: "Pendant", blurb: "One stone on a chain, hanging from a bail or set into the chain itself.", uses: [...CORE, "halo", "accents", "length", "chain", "hang", "clasp"] },
    "drop-pendant": { label: "Drop pendant (build your own)", blurb: "Stack stones, clusters, frames, bows and fringes into a pendant.", uses: ["drop", "length", "chain", "clasp"] },
    "three-stone-pendant": { label: "Three-stone pendant", blurb: "Three stones in a gentle arc on a fine chain, the centre one largest.", uses: [...CORE, "length", "chain", "sides", "hang", "clasp"], defaults: { options: { chain: "fine", lengthIn: 18 }, center: { gem: "diamond", cut: "faceted", shape: "round", lengthMm: 6.5, widthMm: 6.5, domeMm: 1, color: "#f4f6fb", clarity: 0.95, label: "Round brilliant" } } },
    line: { label: "Line necklace (pattern)", blurb: "Stones all the way round in your own pattern: big rounds, small rounds, baguettes, each its own size.", uses: ["accents", "accentShapes", "length", "clasp"], defaults: { options: { lengthIn: 16 }, accents: { shapes: ["round", "round", "baguette", "round"], sizes: [2.2, 1, 1.2, 1], turns: [0, 0, 0, 0], sizeCt: 0.15 } } },
    bar: { label: "Bar on a chain", blurb: "A centre stone with graduated stones on each side, set in a short bar along a fine chain.", uses: [...CORE, "accents", "accentShapes", "length", "chain", "count", "clasp"], defaults: { options: { count: 8, chain: "fine", lengthIn: 16 }, setting: { style: "bezel" }, accents: { enabled: true, sizeCt: 0.12, shapes: ["round"], sizes: [] }, center: { gem: "diamond", cut: "faceted", shape: "cushion", lengthMm: 4.5, widthMm: 4.5, domeMm: 0.8, color: "#f4f6fb", clarity: 0.95, label: "Cushion diamond", carat: null } } },
    riviera: { label: "Riviera", blurb: "A continuous line of graduated stones.", uses: [...CORE, "length", "count"], defaults: { options: { count: 33, lengthIn: 16 } } },
    station: { label: "Station / by the yard", blurb: "Stones spaced along a fine chain.", uses: [...CORE, "length", "chain", "count", "clasp"], defaults: { options: { count: 7, chain: "fine" } } },
    lariat: { label: "Lariat / Y", blurb: "A loop with a long drop ending in the stone.", uses: [...CORE, "length", "chain", "accents"] },
    choker: { label: "Choker", blurb: "Several rows of stones, close to the neck.", uses: ["accents", "fringe", "layers"], defaults: { options: { lengthIn: 14, layers: 3 } } },
    collar: { label: "Collar / fringe", blurb: "A line of stones across the front (rounds, baguettes, any pattern) with graduated drops hanging from it, long and short.", uses: [...CORE, "accents", "accentShapes", "length", "count"], defaults: { options: { lengthIn: 16, count: 15 } } },
    "kundan-choker": { label: "Kundan choker", blurb: "Polki plates with enamel backs and a pearl fringe.", uses: [...CORE, "fringe", "enamel", "count"], defaults: { options: { lengthIn: 14, count: 9 }, fringe: { enabled: true }, enamel: { enabled: true } } },
    "rani-haar": { label: "Rani haar", blurb: "Long multi-strand necklace with a grand pendant.", uses: [...CORE, "accents", "fringe", "enamel", "layers", "length"], defaults: { options: { lengthIn: 28, layers: 4 }, fringe: { enabled: true } } },
    temple: { label: "Temple", blurb: "Gold coin motifs with a ruby-set centre coin.", uses: [...CORE, "count", "length", "fringe"], defaults: { options: { count: 17, lengthIn: 20 } } },
    mangalsutra: { label: "Mangalsutra", blurb: "Black bead strands with gold beads and a pendant.", uses: [...CORE, "length", "layers"], defaults: { options: { lengthIn: 20, layers: 2 } } },
    "by-the-yard": { label: "Diamonds by the yard", blurb: "Bezel-set stones (rose-cut by default) linked by little gold rings, alternating sizes; wrap it once or twice.", uses: [...CORE, "length", "layers"], defaults: { options: { lengthIn: 32, layers: 2 }, center: { gem: "diamond", cut: "rose-cut", shape: "round", lengthMm: 5, widthMm: 5, domeMm: 1.2, color: "#f4f6fb", clarity: 0.95, label: "Rose-cut diamond" }, setting: { style: "bezel" } } },
    "gold-collar": { label: "Gold link collar", blurb: "Rigid gold collar of X-links with pavé, or chevrons with rows of stones.", uses: ["accents", "length", "links"], defaults: { options: { lengthIn: 15, linkStyle: "x" }, metal: "yellow-gold", accents: { sizeCt: 0.02 } } },
    festoon: { label: "Festoon / swag", blurb: "A line of round stones round the neck, with swags of baguette rows draped between jewelled ornaments across the front.", uses: ["center", "accents", "count", "layers", "length", "clasp"], defaults: { options: { lengthIn: 16, count: 2, layers: 3 }, accents: { gem: "diamond", color: "#f4f6fb", cut: "faceted", shapes: ["baguette"], sizes: [], sizeCt: 0.06, orientation: "across", layout: "line" }, center: { gem: "diamond", cut: "faceted", shape: "round", lengthMm: 2.6, widthMm: 2.6, domeMm: 0.6, color: "#f4f6fb", clarity: 0.95, label: "Round brilliant diamonds" } } },
    "briolette-fringe": { label: "Briolette fringe", blurb: "Rows of briolette drops hanging from lines of diamonds, each row a little lower.", uses: ["center", "accents", "layers", "length", "count"], defaults: { options: { lengthIn: 16, layers: 5, count: 25 }, accents: { sizeCt: 0.03 }, center: { gem: "diamond", cut: "briolette", shape: "pear", lengthMm: 6, widthMm: 3.4, domeMm: 1, color: "#f4f6fb", clarity: 0.95, label: "Briolette diamonds", carat: null } } },
    "pearl-strand": { label: "Pearl strand", blurb: "Layered strands of pearls or beads.", uses: ["fringe", "layers", "length", "clasp"], defaults: { options: { layers: 1, lengthIn: 18 }, fringe: { enabled: true, sizeMm: 7 } } },
    freeform: { label: "Unique piece (describe it or from photos)", blurb: "Any design, drawn by the AI from your description or photos as a sketch you can change, then built: swags, garlands, rows and pavé of stones, gold wire, plates and drops, hung from a chain or a line of stones.", uses: ["freeform", "length", "chain", "clasp"] },
    "motif-pendant": { label: "Custom motif pendant", blurb: "Your own shape as the pendant.", uses: ["motif", "center", "accents", "enamel", "fringe", "length", "chain"] },
    "motif-station": { label: "Custom motif stations", blurb: "Your shape repeated along a chain.", uses: ["motif", "center", "accents", "enamel", "length", "chain", "count"], defaults: { options: { count: 7 } } },
  },
  bracelet: {
    tennis: { label: "Tennis / line", blurb: "A full line of stones: one shape, or a repeating mix like round–baguette; straight, waving, or a garland of leaves; one row or several, an optional halo round each stone, and an optional tassel.", uses: ["accents", "accentShapes", "wrist", "layers", "halo", "clasp", "fringe"], defaults: { options: { layers: 1, halo: false } } },
    openwork: { label: "Openwork panel (carpet)", blurb: "Rows of open motifs side by side, each a centre stone in bands of pavé and an edge of seed pearls (or any layers), joined by little diamond beads.", uses: [...CORE, "frames", "accents", "layers", "wrist"],
      defaults: { setting: { style: "bezel" }, options: { layers: 3 }, accents: { gem: "diamond", sizeCt: 0.06, shapes: ["round"] },
        center: { gem: "diamond", cut: "faceted", shape: "marquise", lengthMm: 7, widthMm: 3.5, domeMm: 1, color: "#f4f6fb", clarity: 0.95, rotation: 0, carat: null, label: "Marquise diamond" },
        frames: [
          { kind: "milgrain", outline: "marquise", fit: "point", gem: "diamond", color: "#f4f6fb", cut: "faceted", shape: "round", widthMm: 0.6, gapMm: 0.1 },
          { kind: "stones", outline: "marquise", fit: "point", gem: "diamond", color: "#f4f6fb", cut: "faceted", shape: "round", widthMm: 1.2, gapMm: 0.05 },
          { kind: "stones", outline: "marquise", fit: "point", gem: "diamond", color: "#f4f6fb", cut: "faceted", shape: "round", widthMm: 1.2, gapMm: 0.05 },
          { kind: "stones", outline: "marquise", fit: "point", gem: "pearl", color: "#7a7484", cut: "bead", shape: "round", widthMm: 1.8, gapMm: 0.05 },
        ] } },
    bar: { label: "Bar on a chain", blurb: "A centre stone with graduated stones on each side, set in a short bar along a fine chain.", uses: [...CORE, "accents", "accentShapes", "length", "chain", "count", "clasp"], defaults: { options: { count: 8, chain: "fine", wristCm: 16.5 }, setting: { style: "bezel" }, accents: { enabled: true, sizeCt: 0.12, shapes: ["round"], sizes: [] }, center: { gem: "diamond", cut: "faceted", shape: "cushion", lengthMm: 4.5, widthMm: 4.5, domeMm: 0.8, color: "#f4f6fb", clarity: 0.95, label: "Cushion diamond", carat: null } } },
    "open-bangle": { label: "Open bangle, stone ends", blurb: "An open bangle with a stone at each end, plain or with a channel of stones.", uses: [...CORE, "accents", "pave", "wrist"], defaults: { options: { pave: false }, center: { gem: "diamond", cut: "faceted", shape: "shield", lengthMm: 12, widthMm: 9, domeMm: 1.6, color: "#f4f6fb", clarity: 0.95, label: "Shield-cut diamond" } } },
    bangle: { label: "Bangle", blurb: "Solid bangle with a centre stone.", uses: [...CORE, "wrist"] },
    kada: { label: "Kada", blurb: "Heavy bangle with stones all round the front.", uses: ["accents", "enamel", "wrist", "center", "setting"] },
    cuff: { label: "Cuff", blurb: "Open cuff with a centre stone and rows of accents.", uses: [...CORE, "accents", "wrist", "layers"], defaults: { options: { layers: 2 } } },
    station: { label: "Station", blurb: "Stones spaced along a chain.", uses: [...CORE, "chain", "count", "wrist", "clasp"], defaults: { options: { count: 5, chain: "fine" } } },
    charm: { label: "Charm", blurb: "Chain with dangling set-stone charms.", uses: [...CORE, "chain", "count", "wrist", "clasp"], defaults: { options: { count: 7 } } },
    beaded: { label: "Beaded", blurb: "Strand of beads around a centre stone.", uses: [...CORE, "fringe", "wrist", "layers", "clasp"], defaults: { fringe: { enabled: true, sizeMm: 6 }, options: { layers: 1 } } },
    "motif-station": { label: "Custom motif", blurb: "Your shape repeated along a chain.", uses: ["motif", "center", "accents", "enamel", "chain", "count", "wrist"], defaults: { options: { count: 5 } } },
  },
  anklet: {
    payal: { label: "Payal", blurb: "Chain with ghungroo bells all round.", uses: ["chain", "count", "accents", "enamel"], defaults: { options: { count: 24, chain: "box" } } },
    "station-anklet": { label: "Station anklet", blurb: "Fine chain with a few set stones.", uses: [...CORE, "chain", "count"], defaults: { options: { count: 5, chain: "fine" } } },
  },
  headpiece: {
    "maang-tikka": { label: "Maang tikka", blurb: "A pendant on the forehead, hung from a chain in the parting.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
    tiara: { label: "Tiara", blurb: "Pointed arches of diamond leaves linking graduated spires, pear stones hanging in the arches and crowning the spires, the largest in a halo at the centre.", uses: [...CORE, "accents", "count"], defaults: { options: { count: 7 }, accents: { sizeCt: 0.04 }, center: { gem: "emerald", cut: "faceted", shape: "pear", lengthMm: 14, widthMm: 8, domeMm: 1.2, color: "#0a9a5c", clarity: 0.5, glow: 0.35, label: "Pear emeralds", carat: null } } },
    "matha-patti": { label: "Matha patti", blurb: "Tikka plus chains sweeping along the hairline.", uses: [...CORE, "accents", "fringe", "count", "enamel"], defaults: { fringe: { enabled: true }, options: { count: 5 } } },
  },
  nose: {
    nath: { label: "Nath", blurb: "Large hoop with pearls and beads, chained to the ear.", uses: ["fringe", "accents", "hoop"], defaults: { options: { hoopDiameterMm: 34 }, fringe: { enabled: true, sizeMm: 3.5 } } },
    "nose-stud": { label: "Nose stud", blurb: "A single small stone.", uses: [...CORE, "halo", "accents"], defaults: { center: { gem: "diamond", cut: "faceted", shape: "round", lengthMm: 2.5, widthMm: 2.5, domeMm: 0.4, color: "#f4f6fb", clarity: 0.95, label: "Diamond" } } },
  },
  armlet: {
    bajuband: { label: "Bajuband", blurb: "Armband with a centre motif and stone-set wings.", uses: [...CORE, "accents", "fringe", "enamel"], defaults: { fringe: { enabled: true } } },
  },
  mens: {
    "sherwani-buttons": { label: "Sherwani buttons", blurb: "A set of gold buttons, each a stone framed by calibré stones (or any Deco layers).", uses: [...CORE, "frames", "count"], defaults: { options: { count: 5 }, setting: { style: "bezel" }, center: { gem: "diamond", cut: "faceted", shape: "round", lengthMm: 3.5, widthMm: 3.5, domeMm: 0.6, color: "#f4f6fb", clarity: 0.95, label: "Round diamond", carat: null }, frames: [{ kind: "stones", outline: "round", gem: "emerald", color: "#0a9a5c", cut: "faceted", shape: "princess", widthMm: 1.6, direction: "radial", gapMm: 0.25 }, { kind: "milgrain", outline: "round" }, { kind: "metal", outline: "round", widthMm: 1.2 }] } },
    cufflinks: { label: "Cufflinks", blurb: "Four stones in a square, sugarloaf cabochons by default, in a border of small diamonds.", uses: [...CORE, "accents"], defaults: { center: { gem: "emerald", cut: "cabochon", shape: "princess", lengthMm: 6, widthMm: 6, domeMm: 3.6, color: "#0a9a5c", clarity: 0.45, label: "Sugarloaf emeralds", carat: null }, accents: { sizeCt: 0.015 } } },
  },
  hand: {
    haathphool: { label: "Haathphool", blurb: "Bracelet and ring joined by chains over the hand.", uses: [...CORE, "accents", "chain", "enamel"] },
  },
};

export const MOTIF_STYLE: Partial<Record<PieceType, string>> = { ring: "motif-ring", earrings: "motif", necklace: "motif-pendant", bracelet: "motif-station" };

export const ALL_STYLES = Array.from(new Set(Object.values(STYLES).flatMap((s) => Object.keys(s))));
export const firstStyle = (t: PieceType) => Object.keys(STYLES[t])[0];
export const hasStyle = (t: PieceType, s: string) => Object.hasOwn(STYLES[t], s);
export const styleMeta = (t: PieceType, s: string): StyleMeta => (hasStyle(t, s) ? STYLES[t][s] : STYLES[t][firstStyle(t)]);
export const uses = (d: Design, u: Use) => styleMeta(d.type, d.style).uses.includes(u);

export const accentsOptional = (d: Pick<Design, "type" | "style">) => {
  const u = styleMeta(d.type, d.style).uses;
  return u.includes("center") && (u.includes("accents") || u.includes("halo") || u.includes("pave") || u.includes("accentTop"));
};
export function noAccentsYet(d: Design): string | null {
  if (d.type === "ring" && d.style === "two-stone" && !d.options.halo && d.band.pave === "none")
    return "This ring has no accent stones yet: switch on \"A surround round each stone\" under Construction, or add stones along the band.";
  return null;
}

export const accentsOff = (d: Design) => !d.accents.enabled && accentsOptional(d);

export const SOLID_BRACELETS = new Set(["bangle", "kada", "cuff", "open-bangle"]);
export const isSolidBracelet = (d: Pick<Design, "type" | "style">) => d.type === "bracelet" && SOLID_BRACELETS.has(d.style);

const CLASPS = ["auto", "box", "jewelled", "hidden", "lobster", "spring-ring", "toggle"] as const;
export type ClaspChoice = (typeof CLASPS)[number];
const STONE_LINES = new Set(["line", "pearl-strand", "tennis", "beaded", "festoon", "freeform"]);
export const claspChoices = (style: string): readonly ClaspChoice[] =>
  STONE_LINES.has(style) ? CLASPS : (["auto", "lobster", "spring-ring", "toggle", "box"] as const);

export function resolveClasp(style: string, choice: ClaspChoice): Exclude<ClaspChoice, "auto"> | "none" {
  if (!claspChoices(style).includes(choice)) return resolveClasp(style, "auto");
  if (choice !== "auto") return choice;
  return style === "line" || style === "pearl-strand" || style === "festoon" || style === "freeform" ? "box" : style === "tennis" ? "hidden" : "none";
}
