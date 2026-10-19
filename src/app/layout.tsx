import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import BrandMark from "@/components/BrandMark";
import HeaderNav from "@/components/HeaderNav";
import "@fontsource/bodoni-moda/400.css";
import "@fontsource/bodoni-moda/400-italic.css";
import "@fontsource/jost/300.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import { createClient, hasSupabase } from "@/lib/supabase/server";
import "./globals.css";
import { BRAND } from "@/lib/brand";
import { isStudioAdmin } from "@/lib/studio/admin";

export const metadata: Metadata = { title: BRAND.title, description: BRAND.description };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = hasSupabase() ? (await createClient().auth.getUser()).data.user : null;
  return (
    <html lang="en" data-brand={BRAND.id}>
      <body>
        <header className="topbar">
          <BrandMark />
          <HeaderNav userName={user ? ((user.user_metadata?.display_name as string) || "Signed in") : null} isAdmin={isStudioAdmin(user)} />
        </header>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
