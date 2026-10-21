import type { Metadata } from "next";
import Link from "next/link";
import ComingSoon from "@/components/creator/ComingSoon";
import VideoExamples from "@/components/creator/VideoExamples";
import { VIDEO_EXAMPLES } from "@/lib/video-examples";

export const metadata: Metadata = {
  title: "Video Examples — Mewmax Creator Tools",
  description:
    "Example videos showing the Mewmax creator templates in action.",
};

export default function VideoExamplesPage() {
  // No creator videos exist yet — the page holds its Coming Soon
  // state (the reference's pattern) until real examples land in
  // src/lib/video-examples.ts.
  if (VIDEO_EXAMPLES.length === 0) {
    return <ComingSoon title="Video Examples" />;
  }
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f4f1e8]">
      <div className="mx-auto max-w-6xl px-4 py-10 md:px-8 md:py-14">
        <Link
          href="/creator"
          className="text-sm text-[#9b9ba4] transition-colors hover:text-[#5EEAD4]"
        >
          ← Back to Creator Tools
        </Link>
        <h1 className="mt-4 font-[family-name:var(--font-archivo)] text-4xl font-extrabold tracking-tight md:text-5xl">
          Video Examples
        </h1>
        <p className="mt-3 max-w-2xl text-[#9b9ba4]">
          Watch example videos showcasing template usage and content
          creation tips.
        </p>
        <div className="mt-10">
          <VideoExamples examples={VIDEO_EXAMPLES} />
        </div>
      </div>
    </div>
  );
}
