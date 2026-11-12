import type { Metadata, Viewport } from "next";
import { Caveat, Cormorant_Garamond, Frank_Ruhl_Libre, Heebo, Playpen_Sans_Hebrew, Roboto } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const frank = Frank_Ruhl_Libre({ variable: "--font-frank", subsets: ["hebrew", "latin"], weight: ["300", "400", "500"], display: "swap" });
const cormorant = Cormorant_Garamond({ variable: "--font-cormorant", subsets: ["cyrillic", "latin"], weight: ["300", "400", "500"], style: ["normal", "italic"], display: "swap" });
const heebo = Heebo({ variable: "--font-heebo", subsets: ["hebrew", "latin"], weight: ["300", "400", "500"], display: "swap" });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["cyrillic"], weight: ["300", "400", "500"], display: "swap" });
const playpen = Playpen_Sans_Hebrew({ variable: "--font-playpen", subsets: ["hebrew"], weight: ["300", "400"], display: "swap" });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["cyrillic", "latin"], weight: ["400", "500"], display: "swap" });

export const metadata: Metadata = {
  title: "סבתא רוזה · Бабушка Роза",
  description: "מקום אחד לכל מה שאנחנו זוכרים מסבתא רוזה",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f8f2ed", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const fonts = [frank, cormorant, heebo, roboto, playpen, caveat].map((f) => f.variable).join(" ");
  return (
    <html lang="he" dir="rtl" className={fonts} suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
