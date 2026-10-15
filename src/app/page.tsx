import Link from "next/link";
import { STYLES, TYPES, TYPE_LABEL } from "@/lib/design";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <h1>Design the piece <em>around</em> the stone.</h1>
        <p className="muted">
          Upload a photo or a short video of a gemstone. It&apos;s measured and placed into a 3D piece: a ring, jhumkas, a rani haar,
          a kada, a maang tikka. Work through settings, polki and meenakari, karat and metal, and ask the design consultant for ideas
          drawn from your own style board. Download the render or send it on WhatsApp.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/design" className="btn primary">Start a design</Link>
          <Link href="/style" className="btn">Build your style profile</Link>
        </div>
      </section>
      <section style={{ display: "grid", gap: 22 }}>
        <h2 style={{ fontSize: 28 }}>Every style</h2>
        {TYPES.map((t) => (
          <div key={t} style={{ display: "grid", gap: 8 }}>
            <h3 style={{ fontSize: 18 }}>{TYPE_LABEL[t]}</h3>
            <div className="chips">
              {Object.entries(STYLES[t]).map(([key, s]) => (
                <Link key={key} className="chip" style={{ textTransform: "none" }} href={`/design?type=${t}&style=${key}`} title={s.blurb}>{s.label}</Link>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
