import { applyPatch, metalName, type Design } from "@/lib/design";
import type { ChatMessage } from "@/lib/chat";
import { isPriceQuestion, priceReply } from "@/lib/studio/clientChat";
import { knownPriceReply, priceFor, priceText, type Pricing } from "@/lib/studio/pricing";
import { clampToAllowed, describeChanges, optionLook, optionName, type Allow } from "@/lib/studio/links";

export type ClientPieceData = { designId: string; name: string; base: Design; version: Design; chat: ChatMessage[] };
export type EventKind = "tried-on" | "compared" | "asked-jeweller";

/** what the client screen needs from the server; the demo answers the same questions in the browser */
export interface ClientBackend {
  /** save an adjusted piece; resolves with what was kept (only what's allowed) */
  save(designId: string, design: Design): Promise<Design | null>;
  chat(designId: string, design: Design, messages: { role: "user" | "assistant"; content: string }[], history: ChatMessage[]): Promise<{ reply: string; proposals: { title: string; why: string; design: Design }[] }>;
  event(designId: string | null, kind: EventKind, detail?: { message?: string }): Promise<void>;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong. Please try again.");
  return json as T;
}

/** the real thing: a client link's own routes */
export function linkBackend(token: string): ClientBackend {
  const base = `/api/client/${encodeURIComponent(token)}`;
  return {
    save: (designId, design) => post<{ version: Design }>(`${base}/save`, { designId, design }).then((r) => r.version),
    chat: (designId, design, messages, history) => post(`${base}/chat`, { designId, design, messages, history }),
    event: (designId, kind, detail) => post(`${base}/event`, { designId, kind, ...detail }).then(() => undefined),
  };
}

/**
 * The demo: everything runs in the browser, with the same rules as a real link. The chat answers from a small script
 * (the real one asks Claude) so the demo works with no account, database or API key.
 */
export function demoBackend(pieces: ClientPieceData[], allow: Allow, studioName: string, onEvent?: (line: string) => void, pricing?: Pricing, rate: number | null = null,
  onSave?: (designId: string, d: Design) => void): ClientBackend {
  const baseOf = (id: string) => pieces.find((p) => p.designId === id)!.base;
  const saved = new Map<string, Design>();
  return {
    async save(designId, design) {
      const kept = clampToAllowed(baseOf(designId), design, allow);
      // what the real dashboard records: each saved change, in words
      const before = saved.get(designId) ?? pieces.find((p) => p.designId === designId)!.version;
      if (JSON.stringify(before) !== JSON.stringify(kept)) {
        const changes = describeChanges(baseOf(designId), kept);
        onEvent?.(changes.length ? `Changed the ${pieces.find((p) => p.designId === designId)!.name}: ${changes.join("; ")}` : `Went back to your original ${pieces.find((p) => p.designId === designId)!.name}`);
      }
      saved.set(designId, kept);
      onSave?.(designId, kept);
      return kept;
    },
    async chat(designId, design, messages) {
      await new Promise((r) => setTimeout(r, 900));
      const question = messages[messages.length - 1]?.content ?? "";
      if (isPriceQuestion(question)) {
        // the jeweller's own price, if the piece is one of his priced versions; never the AI's
        const piece = pieces.find((p) => p.designId === designId)!;
        const match = pricing ? priceFor(piece.base, design, pricing.pieces[designId]) : null;
        if (match && pricing) {
          onEvent?.(`Asked the price: "${question}" (shown your price, ${priceText(match.inr, pricing.currency, rate).main})`);
          return { reply: knownPriceReply(studioName, piece.name, match.inr, pricing.currency, rate), proposals: [] };
        }
        onEvent?.(`Asked for a price: "${question}" (sent to you; the assistant never makes up prices)`);
        return { reply: priceReply(studioName), proposals: [] };
      }
      const base = baseOf(designId);
      const ideas: { title: string; why: string; design: Design }[] = [];
      const other = allow.stones.find((o) => o.gem !== design.center.gem);
      if (other && !design.center.none) {
        const look = optionLook(other);
        ideas.push({ title: `Try it with a ${optionName(other)}`, why: "Same setting, a different mood: the house chose this stone as an option for you.",
          design: clampToAllowed(base, applyPatch(design, { center: { gem: other.gem, color: look.color, clarity: look.clarity, glow: look.glow, label: look.label } }), allow) });
      }
      if (allow.stoneScale > 0 && !design.center.none) {
        const k = 1 + Math.min(0.12, allow.stoneScale);
        ideas.push({ title: "A little more presence", why: "A slightly larger centre stone, still in proportion with the setting.",
          design: clampToAllowed(base, applyPatch(design, { center: { lengthMm: design.center.lengthMm * k, widthMm: design.center.widthMm * k } }), allow) });
      }
      const metal = allow.metals.find((m) => m !== design.metal);
      if (metal) ideas.push({ title: `See it in ${metalName({ metal, purity: design.purity }).toLowerCase()}`, why: "Warmer or cooler metal changes how the stone reads against the skin.", design: clampToAllowed(base, applyPatch(design, { metal }), allow) });
      onEvent?.(`Asked the design assistant: "${question}"`);
      return {
        reply: ideas.length
          ? "Here are a couple of ideas within what the jeweller has allowed for this piece. (In the demo these come from a script; on a real link the AI designer answers your exact question.)"
          : "This piece is set exactly as the jeweller designed it. For any change, use Ask the jeweller. (Demo reply.)",
        proposals: ideas.slice(0, 2),
      };
    },
    async event(_designId, kind, detail) {
      onEvent?.(kind === "asked-jeweller" ? `Asked the jeweller: "${detail?.message ?? ""}"` : kind === "tried-on" ? "Tried pieces on" : "Compared pieces");
    },
  };
}
