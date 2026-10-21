import type { Metadata } from "next";
import CleanRatingsBuilder from "@/components/creator/CleanRatingsBuilder";

export const metadata: Metadata = {
  title: "Cleaner Ratings Template — Mewmax Creator Tools",
  description:
    "The simplified ratings card: PSL and Potential, your photo, a 1080x1080 image or an animated MP4.",
};

export default function CleanRatingsTemplatePage() {
  return <CleanRatingsBuilder />;
}
