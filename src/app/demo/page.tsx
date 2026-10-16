import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Demo · ${BRAND.name}` };

/** A walk-through of the studio for the jeweller: what a client sees, what the studio sees, and the workshop sheet. */
export default function DemoPage() {
  const cards = [
    { href: "/demo/client", title: "Try it: both sides at once", body: "Meher's screen, with your side live beside it. Play as her (change the stone, the size, the metal; ask the designer, ask the price) and watch what you'd see: her changes, the price she's shown, the carats and metal weight for the workshop. Then change your settings (what she may choose, your prices) and watch her screen follow." },
    { href: "/demo/studio", title: "Your dashboard", body: "Every link, who opened it and when, what each client changed and tried on, everything they asked the design assistant, and the messages and price requests waiting for you. Open a client to see their version of each piece, the price they're seeing, and its workshop sheet." },
    { href: "/demo/spec", title: "The workshop sheet", body: "For each piece, as designed or as the client adjusted it: every stone with sizes and estimated carats, the metal and its estimated weight, sizes, notes, and the price you quoted. Only you see it, and it prints on one page." },
  ];
  return (
    <main className="page">
      <section className="hero">
        <span className="small muted">Demo · nothing here is saved</span>
        <h1>The {BRAND.name} <em>design</em> studio.</h1>
        <p className="muted">A trial of how you could send designs to clients and work on them together. This demo uses the house&apos;s signature pieces, a sample client, Meher, and sample prices. Start with the first card: it&apos;s hands-on.</p>
      </section>
      <div className="grid">
        {cards.map((c, i) => (
          <Link key={c.href} href={c.href} className="card" style={{ padding: 20, gap: 10, alignContent: "start" }}>
            <span className="small muted">{i + 1}</span>
            <h2 style={{ fontSize: 24 }}>{c.title}</h2>
            <p className="small" style={{ margin: 0 }}>{c.body}</p>
            <span className="small" style={{ color: "var(--accent)" }}>Open →</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
