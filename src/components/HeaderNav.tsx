"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function HeaderNav({ userName, isAdmin }: { userName: string | null; isAdmin: boolean }) {
  const path = usePathname() ?? "";
  if (path.startsWith("/c/") || path === "/demo/client") return null;
  return (
    <nav className="nav">
      <Link href="/design">New design</Link>
      <Link href="/demo">Demo</Link>
      {userName !== null ? (
        <>
          <span className="muted" style={{ textTransform: "none", letterSpacing: 0 }}>{userName}</span>
          <Link href="/rings">My designs</Link>
          <Link href="/inventory">Inventory</Link>
          <Link href="/style">Style profile</Link>
          {isAdmin && <Link href="/studio">Studio</Link>}
          <form action="/auth/signout" method="post"><button className="btn" type="submit">Sign out</button></form>
        </>
      ) : (
        <Link href="/login" className="btn">Sign in</Link>
      )}
    </nav>
  );
}
