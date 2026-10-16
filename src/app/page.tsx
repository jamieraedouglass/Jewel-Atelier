import Link from "next/link";
import { STYLES, TYPES, TYPE_LABEL } from "@/lib/design";
import { BRAND } from "@/lib/brand";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <h1>{BRAND.hero.title} <em>{BRAND.hero.emphasis}</em> {BRAND.hero.after}</h1>
        <p className="muted">{BRAND.hero.body}</p>
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
