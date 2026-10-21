import type { Metadata } from "next";
import AscendTemplateBuilder from "@/components/creator/AscendTemplateBuilder";

export const metadata: Metadata = {
  title: "Ascend Template — Mewmax Creator Tools",
  description:
    "Build your days-until-you-ascend countdown card: your photo, the ring, and a 1080x1920 download.",
};

export default function AscendTemplatePage() {
  return <AscendTemplateBuilder />;
}
