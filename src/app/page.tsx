import Header from "@/components/Header";
import Hero from "@/components/Hero";
import Memories, { WordsBand } from "@/components/Memories";
import Timeline from "@/components/Timeline";
import Album from "@/components/Album";
import VideoInsight from "@/components/VideoInsight";
import HelpSwipe from "@/components/HelpSwipe";
import { Footer } from "@/components/Shell";
import StaticUpload from "@/components/StaticUpload";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <Memories />
        <WordsBand />
        <Timeline />
        <Album />
        <VideoInsight />
        <HelpSwipe />
      </main>
      <Footer />
      <StaticUpload />
    </>
  );
}
