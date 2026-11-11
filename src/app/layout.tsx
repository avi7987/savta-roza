import type { Metadata } from "next";
import { Amatic_SC, Rubik } from "next/font/google";
import Shell from "@/components/Shell";
import "./globals.css";

const rubik = Rubik({ variable: "--font-rubik", subsets: ["hebrew", "cyrillic", "latin"], weight: ["300", "400", "500", "700", "800", "900"] });
const amatic = Amatic_SC({ variable: "--font-amatic", subsets: ["hebrew", "cyrillic", "latin"], weight: ["400", "700"] });

export const metadata: Metadata = {
  title: "סבתא רוזה · Бабушка Роза",
  description: "מקום אחד לכל הזיכרונות של סבתא רוזה",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <body className={`${rubik.variable} ${amatic.variable} antialiased`}>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
