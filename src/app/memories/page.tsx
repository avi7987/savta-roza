import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/sections/Footer";
import MemoriesView from "@/components/memories/MemoriesView";

export const metadata: Metadata = { title: "ספר הזיכרונות · סבתא רוזה" };

/** every memory the family shared, in chapters by kind */
export default function MemoriesPage() {
  return (
    <>
      <Header />
      <MemoriesView />
      <Footer />
    </>
  );
}
