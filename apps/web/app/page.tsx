import Header from "@/components/Header";
import Hero from "@/components/Hero";
import VoiceStudio from "@/components/VoiceStudio";
import StudioQuality from "@/components/StudioQuality";
import TrustedCount from "@/components/TrustedCount";
import AwardsCarousel from "@/components/AwardsCarousel";
import Community from "@/components/Community";
import Faq from "@/components/Faq";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <Hero />
        <VoiceStudio />
        <StudioQuality />
        <TrustedCount />
        <AwardsCarousel />
        <Community />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
