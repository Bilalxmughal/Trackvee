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
import ScrollToTop from '@/components/ScrollToTop';
import { fetchSiteSettings } from '@/lib/settings';

export default async function Home() {
  const s = await fetchSiteSettings();

  return (
    <>
      <Navbar />
      <main>
        <Hero heroImage={s.hero?.imageUrl} />
        <Features />
        <Clients partners={s.partners} />
        <Testimonials reviews={s.reviews} />
        <Solutions solutions={s.solutions} />
        <MobileApp settings={s.mobileApp} />
        <Packages packages={s.packages} />
        <FAQ />
        <Contact contactInfo={s.contact} />
        <CtaBanner />
      </main>
      <WhatsAppButton />
      <ScrollToTop />
    </>
  );
}
