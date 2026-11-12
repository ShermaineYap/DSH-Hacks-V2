import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "Fasa – dengue at home, one day at a time",
  description:
    "Fasa follows the Malaysian MOH dengue guideline day by day: it reads your blood-test slip, checks the warning signs, and tells you whether to rest at home, see a clinic today, or go to hospital now.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1f2a5a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
