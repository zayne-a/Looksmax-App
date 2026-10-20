import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/lib/store";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
  title: "Ascend — Your Most Attractive Self, Measured",
  description:
    "Upload a selfie and get deterministic facial measurements plus a week-by-week softmaxxing plan for skin, diet, exercise and style. Free first scan. $1.99/week.",
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
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </AppProvider>
      </body>
    </html>
  );
}
