import type { ReactNode } from "react";
import CreatorProgramGate from "@/components/CreatorProgramGate";

/**
 * /creator layout (2026-10-22): the whole Creator Tools tree sits
 * behind the owner's creator_program switch (/admin/settings). Off
 * → the gate renders its paused notice instead of every tool.
 */
export default function CreatorLayout({ children }: { children: ReactNode }) {
  return <CreatorProgramGate>{children}</CreatorProgramGate>;
}
