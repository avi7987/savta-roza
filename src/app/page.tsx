import Header from "@/components/Header";
import { LightboxProvider } from "@/components/Lightbox";
import ShareOverlay from "@/components/ShareOverlay";
import Contribute from "@/components/sections/Contribute";
import Footer from "@/components/sections/Footer";
import Hero from "@/components/sections/Hero";
import Letters from "@/components/sections/Letters";
import LifeTimeline from "@/components/sections/LifeTimeline";
import MediaArchive from "@/components/sections/MediaArchive";
import Memories from "@/components/sections/Memories";
import PhotoGallery from "@/components/sections/PhotoGallery";
import Story from "@/components/sections/Story";
import FamilyTree from "@/components/family/FamilyTree";
import { Divider } from "@/components/Botanical";

export default function Home() {
  return (
    <LightboxProvider>
      <Header />
      <main id="content">
        <Hero />
        <Story />
        <FamilyTree />
        <LifeTimeline />
        <PhotoGallery />
        <Divider />
        <Memories />
        <Letters />
        <MediaArchive />
        <Contribute />
      </main>
      <Footer />
      <ShareOverlay />
    </LightboxProvider>
  );
}
