import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { IconMail, IconPhone, IconMapPin, IconBrandWhatsapp, IconClock } from '@tabler/icons-react';

export const metadata: Metadata = {
  title: 'Contact Us | TrackVee — GPS Tracking Pakistan',
  description: 'Get in touch with the TrackVee team for GPS tracking quotes, installation bookings, or support. Based in Lahore, serving all of Pakistan.',
  keywords: 'TrackVee contact, GPS tracking support Pakistan, vehicle tracking Lahore',
};

const contacts = [
  { icon: <IconMail size={18} stroke={1.8} />, label: 'Sales', value: 'sales@trackvee.com', href: 'mailto:sales@trackvee.com' },
  { icon: <IconMail size={18} stroke={1.8} />, label: 'Support', value: 'support@trackvee.com', href: 'mailto:support@trackvee.com' },
  { icon: <IconPhone size={18} stroke={1.8} />, label: 'Phone', value: '+92 300 000 0000', href: 'tel:+923000000000' },
  { icon: <IconBrandWhatsapp size={18} stroke={1.8} />, label: 'WhatsApp', value: '+92 300 000 0000', href: 'https://wa.me/923000000000' },
  { icon: <IconMapPin size={18} stroke={1.8} />, label: 'Location', value: 'Lahore, Punjab, Pakistan', href: null },
  { icon: <IconClock size={18} stroke={1.8} />, label: 'Hours', value: 'Mon – Sat, 9am – 6pm PKT', href: null },
];

const faqs = [
  { q: 'How quickly can you install?', a: 'We typically schedule installation within 2–3 business days in Lahore. Other cities may take 5–7 days.' },
  { q: 'Do you cover cities outside Lahore?', a: 'Yes — we cover Karachi, Islamabad, Rawalpindi, Faisalabad, Multan and more. Contact us for availability.' },
  { q: 'Can I see a live demo first?', a: 'Absolutely. We offer a free live demo session where you can see the platform in action before committing.' },
  { q: 'What happens after I submit this form?', a: 'Our sales team will call or WhatsApp you within 24 hours to discuss your requirements and provide a custom quote.' },
];

export default function ContactPage() {
  return (
    <>
      <Navbar />
      <main>

        {/* Hero */}
        <section className="bg-white px-8 lg:px-16 py-16 border-b border-gray-100">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            Get in touch
          </span>
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-4 leading-tight">
            Let&apos;s get your vehicles online.
          </h1>
          <p className="text-gray-500 text-base max-w-lg leading-relaxed">
            Tell us about your fleet and we&apos;ll put together a quote within 24 hours. No commitment required.
          </p>
        </section>

        <section className="bg-gray-50 px-8 lg:px-16 py-14">
          <div className="flex flex-col lg:flex-row gap-14">

            {/* Left: contact info + map */}
            <div className="lg:w-2/5 space-y-8">

              {/* Contact list */}
              <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
                {contacts.map(c => (
                  <div key={c.label} className="flex items-center gap-4 px-6 py-4">
                    <span className="text-brand shrink-0">{c.icon}</span>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-0.5">{c.label}</p>
                      {c.href ? (
                        <a href={c.href} className="text-sm font-semibold text-gray-800 hover:text-brand transition-colors">{c.value}</a>
                      ) : (
                        <p className="text-sm font-semibold text-gray-800">{c.value}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Google Maps embed */}
              <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d108879.2563707725!2d74.23149415!3d31.48290305!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x39190483e58107d9%3A0xc23abe9765f56d47!2sLahore%2C%20Punjab%2C%20Pakistan!5e0!3m2!1sen!2s!4v1700000000000!5m2!1sen!2s"
                  width="100%"
                  height="240"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="TrackVee — Lahore, Pakistan"
                />
              </div>

            </div>

            {/* Right: FAQ + CTA */}
            <div className="lg:w-3/5 space-y-8">

              {/* Quote CTA card */}
              <div className="bg-brand rounded-2xl p-8 text-white">
                <p className="text-xs font-bold tracking-widest uppercase text-white/60 mb-2">Quickest way to reach us</p>
                <h2 className="text-2xl font-extrabold mb-3 leading-snug">Chat with us on WhatsApp</h2>
                <p className="text-white/80 text-sm mb-6 leading-relaxed">
                  Send us your vehicle count and city — we&apos;ll reply with a personalised quote within a few hours.
                </p>
                <a
                  href="https://wa.me/923000000000?text=Hi%2C%20I%27m%20interested%20in%20TrackVee%20GPS%20tracking.%20Please%20send%20me%20a%20quote."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-white text-brand font-bold text-sm px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <IconBrandWhatsapp size={18} stroke={2} />
                  Open WhatsApp
                </a>
              </div>

              {/* Quick FAQs */}
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-5">Quick answers</p>
                <div className="divide-y divide-gray-100">
                  {faqs.map(f => (
                    <div key={f.q} className="py-4 first:pt-0 last:pb-0">
                      <p className="text-sm font-bold text-gray-900 mb-1.5">{f.q}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>
        </section>

      </main>

      {/* Footer strip */}
      <div className="bg-white border-t border-gray-100 px-8 lg:px-16 py-5 flex flex-wrap justify-between items-center gap-3">
        <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} TrackVee. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Terms of Service</Link>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Home</Link>
        </div>
      </div>
    </>
  );
}
