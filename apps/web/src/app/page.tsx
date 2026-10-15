import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import Clients from '@/components/Clients';
import Partners from '@/components/Partners';
import Solutions from '@/components/Solutions';
import Packages from '@/components/Packages';
import CtaBanner from '@/components/CtaBanner';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <Clients />
        <Partners />
        <Solutions />
        <Packages />
        <CtaBanner />
      </main>
      <Footer />
    </>
  );
}
