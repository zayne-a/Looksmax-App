import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import SiteChrome from "@/components/SiteChrome";
import SupportChat from "@/components/SupportChat";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Mewmax — PSL Score & Looksmax",
  description:
    "Upload a selfie and get deterministic facial measurements plus a week-by-week softmaxxing plan for skin, diet, exercise and style. Free first scan. $1.99/week.",
  openGraph: {
    title: "Mewmax — PSL Score & Looksmax",
    description:
      "Upload a selfie and get deterministic facial measurements plus a week-by-week softmaxxing plan for skin, diet, exercise and style. Free first scan. $1.99/week.",
    siteName: "Mewmax",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Mewmax — PSL Score & Looksmax",
    description:
      "Upload a selfie and get deterministic facial measurements plus a week-by-week softmaxxing plan for skin, diet, exercise and style. Free first scan. $1.99/week.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${archivo.variable}`}>
      <body>
        <AppProvider>
          <SiteChrome>{children}</SiteChrome>
          <SupportChat />
        </AppProvider>
      </body>
    </html>
  );
}
