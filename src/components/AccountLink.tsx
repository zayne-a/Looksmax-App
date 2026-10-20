"use client";

import Link from "next/link";
import { useApp } from "@/lib/store";

/** Navbar account entry: Log in when signed out; Dashboard (with an
 *  Admin/Pro tag) when signed in. */
export default function AccountLink() {
  const { user, profile } = useApp();
  if (!user) {
    return (
      <Link href="/login" className="transition hover:text-bone">
        Log in
      </Link>
    );
  }
  const tag = profile?.is_admin ? " · Admin" : profile?.is_premium ? " · Pro" : "";
  return (
    <Link href="/dashboard" className="transition hover:text-bone">
      Dashboard{tag}
    </Link>
  );
}
