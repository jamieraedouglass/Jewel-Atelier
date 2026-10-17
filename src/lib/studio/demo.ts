import { SHOWCASE, applyPatch, showcaseDesign, type Design } from "../design";
import type { ChatMessage } from "../chat";
import { BRAND } from "../brand";
import { describeChanges, normalizeAllow } from "./links";
import { priceReply } from "./clientChat";
import { priceFor, type Pricing } from "./pricing";
import type { DashEvent, DashLink } from "./dashboard";

const piece = (id: string, name: string) => {
  const entry = SHOWCASE.find((s) => s.name === name);
  if (!entry) throw new Error(`no showcase piece ${name}`);
  const design: Design = showcaseDesign(entry);
  return { designId: id, name: entry.name, base: design, version: design, chat: [] as ChatMessage[] };
};

export const DEMO_PIECES = [
  piece("00000000-0000-4000-8000-000000000001", "Half-flowered Burmese ruby ring"),
  piece("00000000-0000-4000-8000-000000000002", "Half-flowered emerald ring"),
  piece("00000000-0000-4000-8000-000000000003", "Kashi Kamal earrings"),
];
export const DEMO_NAMES = Object.fromEntries(DEMO_PIECES.map((p) => [p.designId, p.name]));

export const DEMO_ALLOW = normalizeAllow({
  sizes: true,
  stones: [{ gem: "ruby", grade: "burmese" }, { gem: "emerald", grade: "colombian" }, { gem: "sapphire", grade: "kashmir" }],
  shapes: ["cushion", "oval", "emerald"],
  stoneScale: 0.25,
  metals: ["yellow-gold", "platinum"],
  karats: [18, 22],
  chat: true,
});

export const DEMO_PRICING: Pricing = {
  currency: "INR",
  pieces: {
    "00000000-0000-4000-8000-000000000001": [{ inr: 485000 }, { inr: 515000, karat: 22 }, { inr: 440000, stone: { gem: "emerald", grade: "colombian" } }],
    "00000000-0000-4000-8000-000000000002": [{ inr: 395000 }],
    "00000000-0000-4000-8000-000000000003": [{ inr: 265000 }],
  },
};

export const DEMO_CLIENT = {
  name: "Meher",
  note: "Meher, as we discussed: the two half-flowered rings to choose between, and the Kashi Kamal earrings to go with them. Try them on, play with the stone and size, and tell me what you think. Carl",
};

export const MEHER_RUBY: Design = (() => {
  const base = DEMO_PIECES[0].base;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return applyPatch(base, { purity: { karat: 22 }, ringSize: 6, center: { lengthMm: r1(base.center.lengthMm * 1.1), widthMm: r1(base.center.widthMm * 1.1), carat: null } });
})();

const MEHER_CHATS: Record<string, ChatMessage[]> = {
  [DEMO_PIECES[1].designId]: [
    { role: "user", content: "Would the emerald one be too green for everyday?" },
    { role: "assistant", content: "Not at all. A Colombian-look emerald is a deep, slightly blue green, and set in platinum it looks fresh and crisp rather than loud. The half-flower keeps the stone close to the finger, so it's comfortable to wear every day. If you'd like it a little quieter, a slightly smaller stone keeps the same look with less presence.",
      proposals: [{ title: "A little smaller", why: "The same emerald and setting, about 10% smaller.", patch: {}, state: "dismissed" }] },
  ],
  [DEMO_PIECES[0].designId]: [
    { role: "user", content: "Would 22k make the ruby look warmer?" },
    { role: "assistant", content: "Yes. 22k gold is a richer, deeper yellow than 18k, so it warms the red of the ruby and gives the ring a more traditional feel. It is also a little softer than 18k; the jeweller can tell you how that would suit a ring you'd wear every day.",
      proposals: [{ title: "See it in 22k", why: "Warmer gold around the ruby.", patch: { purity: { karat: 22 } }, state: "applied" }] },
    { role: "user", content: "What would this cost?" },
    { role: "assistant", content: priceReply(BRAND.studioName) },
  ],
};

export function demoStudio(now = Date.now()) {
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
  const [r1, r2, e1] = DEMO_PIECES.map((p) => p.designId);
  const rubyChanges = describeChanges(DEMO_PIECES[0].base, MEHER_RUBY);
  const links: DashLink[] = [
    { id: "demo-meher", client_name: "Meher", design_ids: [r1, r2, e1], created_at: ago(30), last_opened_at: ago(2), expires_at: null, revoked: false },
    { id: "demo-meera", client_name: "Meera & Vikram", design_ids: [e1], created_at: ago(80), last_opened_at: ago(26), expires_at: null, revoked: false },
    { id: "demo-sara", client_name: "Sara", design_ids: [r2], created_at: ago(24 * 40), last_opened_at: ago(24 * 33), expires_at: ago(24 * 10), revoked: false },
  ];
  let id = 0;
  const ev = (link: string, design: string | null, kind: string, h: number, detail: Record<string, unknown> = {}): DashEvent => ({ id: ++id, link_id: link, design_id: design, kind, detail, at: ago(h) });
  const events: DashEvent[] = [
    ev("demo-meher", null, "opened", 20),
    ev("demo-meher", r1, "changed", 19.8, { changes: rubyChanges.filter((c) => c.startsWith("Ring size")) }),
    ev("demo-meher", null, "compared", 19.5),
    ev("demo-meher", r2, "asked-designer", 19.2, { question: "Would the emerald one be too green for everyday?" }),
    ev("demo-meher", null, "opened", 2.5),
    ev("demo-meher", r1, "asked-designer", 2.4, { question: "Would 22k make the ruby look warmer?" }),
    ev("demo-meher", r1, "changed", 2.3, { changes: rubyChanges.filter((c) => !c.startsWith("Ring size")) }),
    ev("demo-meher", r1, "asked-price", 2.2, { question: "What would this cost?" }),
    ev("demo-meher", null, "tried-on", 2.1),
    ev("demo-meher", r1, "asked-jeweller", 2, { message: "I love the ruby one in 22k. Could the band be a little thinner? And what would it cost?" }),
    ev("demo-meera", null, "opened", 26),
    ev("demo-meera", e1, "tried-on", 25.8),
    ev("demo-meera", e1, "asked-designer", 25.5, { question: "Are these heavy to wear for a whole evening?" }),
    ev("demo-sara", null, "opened", 24 * 33),
  ];
  const accounts = [
    { id: "a-carl", name: "Carl", designs: 14, lastSignIn: ago(1) },
    { id: "a-priya", name: "Priya (workshop)", designs: 5, lastSignIn: ago(28) },
    { id: "a-dev", name: "Dev", designs: 2, lastSignIn: ago(24 * 6) },
  ];
  return { links, events, accounts };
}

export function demoLinkDetail(id: string, now = Date.now()) {
  const { links, events } = demoStudio(now);
  const link = links.find((l) => l.id === id);
  if (!link) return null;
  const pieces = link.design_ids.map((did) => {
    const p = DEMO_PIECES.find((x) => x.designId === did)!;
    const version = id === "demo-meher" && did === DEMO_PIECES[0].designId ? MEHER_RUBY : p.base;
    const versions = id === "demo-meher" ? DEMO_PRICING.pieces[did] : undefined;
    return {
      designId: did, name: p.name, base: p.base, version, changes: describeChanges(p.base, version), chat: id === "demo-meher" ? MEHER_CHATS[did] ?? [] : [],
      priced: priceFor(p.base, version, versions), hasPrices: !!versions?.length,
    };
  });
  return { link, pieces, events: events.filter((e) => e.link_id === id).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)) };
}
