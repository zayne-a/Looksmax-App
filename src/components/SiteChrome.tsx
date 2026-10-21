"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * The app zone: /dashboard and /coach are the subscriber's app, not
 * pages on the marketing website (Zayne, 2026-10-21). Inside the zone
 * the website header/footer/nav never render — the screens carry only
 * their own app chrome (the dashboard's app bar + AppNav, the coach's
 * own header + AppNav). Every other route keeps the website shell
 * exactly as before.
 */
const APP_ZONE_PREFIXES = ["/dashboard", "/coach"];

export function isAppZone(pathname: string | null): boolean {
  if (!pathname) return false;
  return APP_ZONE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export default function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isAppZone(pathname)) {
    return <main className="min-h-screen">{children}</main>;
  }
  return (
    <>
      <Navbar />
      <main className="min-h-screen">{children}</main>
      <Footer />
    </>
  );
}
