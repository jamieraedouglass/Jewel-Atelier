"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND } from "@/lib/brand";

export default function BrandMark() {
  const path = usePathname() ?? "";
  const isClient = path.startsWith("/c/") || path === "/demo/client";
  if (BRAND.wordmark.sub) {
    const inner = <><span className="main">{BRAND.wordmark.main}</span><span className="sub">{BRAND.wordmark.sub}</span></>;
    return isClient ? <span className="wordmark" aria-label={BRAND.name}>{inner}</span> : <Link href="/" className="wordmark" aria-label={BRAND.name}>{inner}</Link>;
  }
  const inner = <>{BRAND.wordmark.main} <em>{BRAND.wordmark.accent}</em></>;
  return isClient ? <span className="brand">{inner}</span> : <Link href="/" className="brand">{inner}</Link>;
}
