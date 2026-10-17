import "server-only";
import type { Currency } from "./pricing";

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
