import type { Metadata } from "next";
import { VideoExamplesLoader } from "@/components/creator/VideoExamples";

export const metadata: Metadata = {
  title: "Video Examples — Mewmax Creator Tools",
  description:
    "Example videos showing the Mewmax creator templates in action.",
};

/**
 * Server shell only — the content is DB-driven. The client loader
 * fetches the `creator-examples` and `replays` collections from the
 * unified content system (managed in /admin/content) and renders
 * the Coming Soon state when both are empty.
 */
export default function VideoExamplesPage() {
  return <VideoExamplesLoader />;
}
