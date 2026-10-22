import type { Metadata } from "next";
import type { ReactNode } from "react";
import PortalShell from "@/components/portal/PortalShell";
import CreatorProgramGate from "@/components/CreatorProgramGate";

export const metadata: Metadata = {
  title: "Creator Portal — Mewmax",
  description:
    "The Mewmax Creator Portal: connect your accounts, verify, submit videos and track your earnings.",
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <CreatorProgramGate>
      <PortalShell>{children}</PortalShell>
    </CreatorProgramGate>
  );
}
