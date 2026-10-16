import "server-only";
import type { Currency } from "./pricing";

/**
 * Today's exchange rate from rupees, for showing Carl's rupee prices in a client's own currency. The free source
 * (open.er-api.com, no account needed) updates about once a day; we check it at most hourly. If it can't be reached the
 * price simply shows in rupees.
 */
export async function rupeeRate(currency: Currency): Promise<number | null> {
  if (currency === "INR") return 1;
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/INR", { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: string; rates?: Record<string, number> };
    const rate = json.result === "success" ? json.rates?.[currency] : undefined;
    return typeof rate === "number" && rate > 0 ? rate : null;
  } catch {
    return null;
  }
}
