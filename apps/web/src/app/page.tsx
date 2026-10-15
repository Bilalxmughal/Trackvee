import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Clients from '@/components/Clients';
import Testimonials from '@/components/Testimonials';
import Solutions from '@/components/Solutions';
import MobileApp from '@/components/MobileApp';
import Packages from '@/components/Packages';
import FAQ from '@/components/FAQ';
import Contact from '@/components/Contact';
import CtaBanner from '@/components/CtaBanner';
import WhatsAppButton from '@/components/WhatsAppButton';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Clients />
        <Testimonials />
        <Solutions />
        <MobileApp />
        <Packages />
        <FAQ />
        <Contact />
        <CtaBanner />
      </main>
      <WhatsAppButton />
    </>
  );
}
