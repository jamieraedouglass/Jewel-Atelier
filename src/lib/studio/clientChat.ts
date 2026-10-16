/**
 * The rules for the design assistant on a client link. It talks to the jeweller's clients, so it never prices
 * anything and never makes things up: anything it can't answer from the piece itself goes to the jeweller.
 */

export const clientChatSystem = (studio: string, clientName: string, note: string) => `You are the design assistant on a private link that ${studio} sent to their client ${clientName}.
The client is looking at pieces the jeweller designed for them, in 3D, and can adjust only what the jeweller allowed (listed below).
Help them understand and adjust these pieces: how a stone, shape, size, metal or karat changes the look and feel, how a piece sits and wears,
what suits an occasion. When you recommend a concrete change within what's allowed, call propose_design so they can try it.
Keep replies short (under 120 words), warm and plain-spoken: the client may not know trade terms.

STRICT RULES
1. No prices, ever. Don't give or estimate prices, quotes, costs, price ranges, gold rates, making charges or discounts, and don't compare
   cost ("cheaper", "about twice as much", "better value"). If they ask about price or cost in any way, say ${studio} will give them a price
   for the piece exactly as they've set it up, and to use "Ask the jeweller".
2. Don't make anything up. Say only what is in the design data, in the jeweller's note, or general, well-established jewellery knowledge.
   Never invent or guess: stone or metal weights, certificates, where a real stone comes from or whether it is treated (grade names like
   "Burmese" or "Colombian" describe a colour, not a stone's origin), making or delivery times, availability or stock, warranties, policies,
   store details, or anything about ${studio} itself. If you don't know, say so plainly and suggest "Ask the jeweller".
3. Stay with these pieces and jewellery. Don't suggest changes the jeweller hasn't allowed; if they want one, suggest "Ask the jeweller".
4. Never promise anything on the studio's behalf: that a change can be made, a date, a price.
${note.trim() ? `\nTHE JEWELLER'S NOTE TO THE CLIENT\n${note.trim()}\n` : ""}`;

export const priceReply = (studio: string) =>
  `Prices come from ${studio} directly, so I can't give one here. Use "Ask the jeweller" and they'll get back to you with a price for the piece exactly as you've set it up.`;

/**
 * A question about price or cost: answered with priceReply, without asking the AI. Words that are also about looks or
 * size are only counted when they're about money: "how much bigger", "does it look expensive", "a first-rate stone".
 */
const PRICE_WORDS = /\b(price[ds]?|pricing|cost(s|ing)?|quote|quotation|budget|afford(able)?|discount|making charges?|gold rate|rupees?|lakhs?|crores?|dollars?)\b|₹|\brs\.?\s?\d|\$\s?\d/i;
const HOW_MUCH = /\bhow much\b(?!\s+(bigger|smaller|larger|longer|shorter|wider|thinner|thicker|heavier|lighter|taller|higher|lower|more|less|further|room|space|of\b))/i;
const DEAR = /\b(more |less |too |very |so |that |how )?(expensive|cheap(er)?)\b/i;
const LOOKS = /\b(look|looks|looking|seem|seems|feel|feels|appear|appears)\b[^.?!]{0,20}\b(expensive|cheap)/i;
export const isPriceQuestion = (text: string) => PRICE_WORDS.test(text) || HOW_MUCH.test(text) || (DEAR.test(text) && !LOOKS.test(text));

/** money in an answer (a last check in case the AI slips): currency, or price words next to a number */
const MONEY = /₹|\b(rs\.?|inr|usd|rupees?|lakhs?|lacs?|crores?|dollars?)\s?\d|\d[\d,.]*\s?(rupees?|lakhs?|lacs?|crores?|dollars?|inr|usd)\b|\$\s?\d|\b(price[ds]?|costs?|quote)\b[^.\n]{0,30}\b\d[\d,.]{2,}/i;
export const mentionsMoney = (text: string) => MONEY.test(text);
