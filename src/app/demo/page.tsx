import Link from "next/link";
import { BRAND } from "@/lib/brand";

export const metadata = { title: `Demo · ${BRAND.name}` };

/** A walk-through of the studio for the jeweller: what a client sees, what the studio sees, and the workshop sheet. */
export default function DemoPage() {
  const cards = [
    { href: "/demo/client", title: "What your client sees", body: "A private link with the pieces you chose for them: in 3D, side by side, tried on together at true size. They adjust only what you allow (size, your choice of stones, metal) and can ask the designer or write to you." },
    { href: "/demo/studio", title: "What you see", body: "Every link, who opened it and when, what each client changed, tried on and asked, and the messages waiting for you. You can also see into every account in the studio." },
    { href: "/demo/spec", title: "The workshop sheet", body: "For each piece, as designed or as the client adjusted it: every stone with sizes and estimated carats, the metal and its estimated weight, sizes and notes. Only you see it, and it prints on one page." },
  ];
  return (
    <main className="page">
      <section className="hero">
        <span className="small muted">Demo · nothing here is saved</span>
        <h1>The {BRAND.name} <em>design</em> studio.</h1>
        <p className="muted">A trial of how you could send designs to clients and work on them together. This demo uses the house&apos;s signature pieces and a sample client, Meher.</p>
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
