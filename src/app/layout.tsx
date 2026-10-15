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
  title: "Ring Atelier",
  description: "Design a ring around your own stone, in 3D, with an AI design consultant.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  return (
    <html lang="en">
      <body>
        <header className="topbar">
          <Link href="/" className="brand">Ring <em>Atelier</em></Link>
          <nav className="nav">
            <Link href="/design">New ring</Link>
            {user ? (
              <>
                <Link href="/rings">My rings</Link>
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
