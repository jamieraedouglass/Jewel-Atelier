type BrandId = "atelier" | "kothari";

type Brand = {
  id: BrandId;
  name: string;
  wordmark: { main: string; sub?: string; accent?: string };
  title: string;
  description: string;
  hero: { title: string; emphasis: string; after: string; body: string };
  showcaseCategory: "kothari" | "ring";
  studioName: string;
  private: boolean;
  stockSheet: boolean;
};

const BRANDS: Record<BrandId, Brand> = {
  atelier: {
    id: "atelier",
    name: "Jewel Atelier",
    wordmark: { main: "Jewel", accent: "Atelier" },
    title: "Atelier",
    description: "Design jewellery around your own stones, in 3D, with an AI design consultant.",
    hero: {
      title: "Design the piece", emphasis: "around", after: "the stone.",
      body: "Upload a photo or a short video of a gemstone. It's measured and placed into a 3D piece: a ring, jhumkas, a rani haar, a kada, a maang tikka. Work through settings, polki and meenakari, karat and metal, and ask the design consultant for ideas drawn from your own style board.",
    },
    showcaseCategory: "ring",
    studioName: "Jewel Atelier",
    private: false,
    stockSheet: false,
  },
  kothari: {
    id: "kothari",
    name: "Kotharis Jewellers",
    wordmark: { main: "Kotharis", sub: "JEWELLERS" },
    title: "Kotharis Jewellers · Design studio",
    description: "Design your piece with Kotharis Jewellers: see it in 3D, try it on, and refine it with us.",
    hero: {
      title: "Your piece,", emphasis: "made", after: "around you.",
      body: "Colombian emeralds, Burmese rubies, old-cut diamonds and briolettes, set the way the house has set them for generations. See each design in 3D, try it on at true size, and adjust it with us before it goes to the workshop.",
    },
    showcaseCategory: "kothari",
    studioName: "Kotharis Jewellers",
    private: true,
    stockSheet: true,
  },
};

const brandFor = (id: string | undefined): Brand => (id && id in BRANDS ? BRANDS[id as BrandId] : BRANDS.atelier);
export const BRAND = brandFor(process.env.NEXT_PUBLIC_BRAND);
