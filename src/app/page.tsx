import Header from "@/components/Header";
import { LightboxProvider } from "@/components/Lightbox";
import ShareOverlay from "@/components/ShareOverlay";
import Contribute from "@/components/sections/Contribute";
import Footer from "@/components/sections/Footer";
import Hero from "@/components/sections/Hero";
import LifeStory from "@/components/sections/LifeStory";
import Memories from "@/components/sections/Memories";
import FamilyTree from "@/components/family/FamilyTree";

export default function Home() {
  return (
    <LightboxProvider>
      <Header />
      <main id="content">
        <Hero />
        <LifeStory />
        <FamilyTree />
        <Memories />
        <Contribute />
      </main>
      <Footer />
      <ShareOverlay />
    </LightboxProvider>
  );
}
