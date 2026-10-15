import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <section className="hero">
        <h1>Design the ring <em>around</em> the stone.</h1>
        <p className="muted">
          Upload a photo or short video of your gemstone and it&apos;s measured and placed into a 3D ring. Try side stones,
          settings and metals, ask the design consultant for ideas drawn from your own style board, and share a link with
          your jeweller or friends.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/design" className="btn primary">Start a ring</Link>
          <Link href="/style" className="btn">Build your style profile</Link>
        </div>
      </section>
    </main>
  );
}
