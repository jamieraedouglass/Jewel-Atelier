import { SHOWCASE, showcaseDesign, type Design } from "../design";
import { normalizeAllow } from "./links";
import type { DashEvent, DashLink } from "./dashboard";

/**
 * The demo to show the studio: a sample client link and a dashboard with sample activity, built from the house's
 * signature pieces. Nothing here touches a database.
 */

const piece = (id: string, name: string) => {
  const entry = SHOWCASE.find((s) => s.name === name);
  if (!entry) throw new Error(`no showcase piece ${name}`);
  const design: Design = showcaseDesign(entry);
  return { designId: id, name: entry.name, base: design, version: design, chat: [] };
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

export const DEMO_CLIENT = {
  name: "Meher",
  note: "Meher, as we discussed: the two half-flowered rings to choose between, and the Kashi Kamal earrings to go with them. Try them on, play with the stone and size, and tell me what you think. Carl",
};

/** sample activity, dated relative to now so the dashboard always looks current */
export function demoStudio(now = Date.now()) {
  const ago = (h: number) => new Date(now - h * 3_600_000).toISOString();
  const [r1, r2, e1] = DEMO_PIECES.map((p) => p.designId);
  const links: DashLink[] = [
    { id: "demo-meher", client_name: "Meher", design_ids: [r1, r2, e1], created_at: ago(30), last_opened_at: ago(2), expires_at: null, revoked: false },
    { id: "demo-meera", client_name: "Meera & Vikram", design_ids: [e1], created_at: ago(80), last_opened_at: ago(26), expires_at: null, revoked: false },
    { id: "demo-sara", client_name: "Sara", design_ids: [r2], created_at: ago(24 * 40), last_opened_at: ago(24 * 33), expires_at: ago(24 * 10), revoked: false },
  ];
  let id = 0;
  const ev = (link: string, design: string | null, kind: string, h: number, detail: Record<string, unknown> = {}): DashEvent => ({ id: ++id, link_id: link, design_id: design, kind, detail, at: ago(h) });
  const events: DashEvent[] = [
    ev("demo-meher", null, "opened", 20),
    ev("demo-meher", r1, "changed", 19.8, { changes: ["Ring size US 6.5 → 6 (Indian 12)"] }),
    ev("demo-meher", null, "compared", 19.5),
    ev("demo-meher", r2, "asked-designer", 19.2, { question: "Would the emerald one be too green for everyday?" }),
    ev("demo-meher", null, "opened", 2.5),
    ev("demo-meher", r1, "changed", 2.3, { changes: ["Metal 18k Yellow gold → 22k Yellow gold", "Stone size 8.4 × 8.4 → 9.2 × 9.2 mm"] }),
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
