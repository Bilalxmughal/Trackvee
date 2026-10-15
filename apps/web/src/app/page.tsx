import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Clients from '@/components/Clients';
import Solutions from '@/components/Solutions';
import Packages from '@/components/Packages';
import Contact from '@/components/Contact';
import CtaBanner from '@/components/CtaBanner';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Clients />
        <Solutions />
        <Packages />
        <Contact />
        <CtaBanner />
      </main>

    </>
  );
}
