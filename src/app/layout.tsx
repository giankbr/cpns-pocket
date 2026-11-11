import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Hanken_Grotesk, Instrument_Serif } from "next/font/google";
import { themeBootScript } from "@/lib/theme-script";
import "./globals.css";

const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "CPOCKET",
  description: "Ruang belajar pribadi untuk persiapan CPNS.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The boot script sets data-theme before hydration, so the attribute differs by design.
    <html lang="id" className={`${hanken.variable} ${instrumentSerif.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
