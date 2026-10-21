import type { Metadata } from "next";
import RatingsTemplateBuilder from "@/components/creator/RatingsTemplateBuilder";

export const metadata: Metadata = {
  title: "Original Ratings Template — Mewmax Creator Tools",
  description:
    "The full ratings card: PSL, Potential, Eyes, Midface, Lower Third and Upper Third in one 1080x1920 download.",
};

export default function RatingsTemplatePage() {
  return <RatingsTemplateBuilder />;
}
