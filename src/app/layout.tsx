import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier",
  description: "Design jewellery around your own stones, in 3D, with an AI design consultant.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Jewel <em>Atelier</em></Link>
          <nav className="nav">
            <Link href="/design">New design</Link>
            {user ? (
              <>
                <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>{(user.user_metadata?.display_name as string) || "Signed in"}</span>
                <Link href="/rings">My designs</Link>
                <Link href="/inventory">Inventory</Link>
                <Link href="/style">Style profile</Link>
                <form action="/auth/signout" method="post"><button className="btn" type="submit">Sign out</button></form>
              </>
            ) : (
              <Link href="/login" className="btn">Sign in</Link>
            )}
          </nav>
        </header>
        {children}
      </body>
    </html>
  );
}
