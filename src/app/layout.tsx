import type { Metadata, Viewport } from "next";
import Shell from "@/components/Shell";
// the fonts ship with the site instead of being fetched from Google at build time
import "@fontsource/frank-ruhl-libre/300.css";
import "@fontsource/frank-ruhl-libre/400.css";
import "@fontsource/frank-ruhl-libre/500.css";
import "@fontsource/cormorant-garamond/300.css";
import "@fontsource/cormorant-garamond/400.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/300-italic.css";
import "@fontsource/cormorant-garamond/400-italic.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/heebo/300.css";
import "@fontsource/heebo/400.css";
import "@fontsource/heebo/500.css";
import "@fontsource/roboto/cyrillic-300.css";
import "@fontsource/roboto/cyrillic-400.css";
import "@fontsource/roboto/cyrillic-500.css";
import "@fontsource/playpen-sans-hebrew/hebrew-300.css";
import "@fontsource/playpen-sans-hebrew/hebrew-400.css";
import "@fontsource/caveat/400.css";
import "@fontsource/caveat/500.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "סבתא רוזה · Бабушка Роза",
  description: "מקום אחד לכל מה שאנחנו זוכרים מסבתא רוזה",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#f8f2ed", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
