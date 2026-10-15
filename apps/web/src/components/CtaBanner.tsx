import Image from 'next/image';
import Link from 'next/link';

const steps = [
  { n: 1, title: 'Get a quote', desc: 'Tell us about your vehicles and requirements.' },
  { n: 2, title: 'Professional installation', desc: 'Our team installs the device at your location.' },
  { n: 3, title: 'Start tracking', desc: 'Log in and see your vehicles live on the map.' },
  { n: 4, title: 'Ongoing support', desc: 'Our team is here to help whenever you need us.' },
];

const socials = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/trackvee',
    icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/><circle cx="4" cy="4" r="2"/></svg>,
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/Trackvee',
    icon: <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>,
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/Trackvee',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>,
  },
];

export default function CtaBanner() {
  return (
    <div className="min-h-screen flex flex-col">

      {/* How it works */}
      <div id="how-it-works" className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-10 bg-gray-50">
        <div className="mb-8">
          <span className="text-xs font-bold tracking-widest uppercase text-brand">How it works</span>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900 leading-tight mb-2">
            Up and running in no time.
          </h2>
          <p className="text-sm text-gray-500 max-w-md">From installation to insights, we make it simple.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map(s => (
            <div key={s.n} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-brand text-white font-extrabold text-xs flex items-center justify-center shrink-0">{s.n}</div>
              <div>
                <h4 className="font-bold text-gray-900 mb-0.5 text-sm">{s.title}</h4>
                <p className="text-xs text-gray-500">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ready to track smarter — CTA */}
      <section className="bg-brand py-12 px-8 lg:px-16 text-center">
        <div className="w-full max-w-2xl mx-auto">
          <h2 className="text-3xl font-extrabold text-white tracking-tight mb-3">Ready to track smarter?</h2>
          <p className="text-white/80 text-base mb-7">Get in touch with our team and we&apos;ll have your vehicles online in no time.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="#contact" className="bg-white text-brand font-bold px-7 py-3 rounded-lg text-sm hover:bg-gray-50 transition-colors">Get a quote</a>
            <a href="#packages" className="bg-white/15 text-white border border-white/40 font-semibold px-7 py-3 rounded-lg text-sm hover:bg-white/20 transition-colors">See packages</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white px-8 lg:px-16 pt-8 pb-0">
        <div className="w-full">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div>
              <Link href="#home">
                <Image src="/logo.webp" alt="TrackVee" width={140} height={40} className="h-8 w-auto mb-2.5 mix-blend-multiply" />
              </Link>
              <p className="text-xs text-gray-500 max-w-xs mb-3">Reliable GPS vehicle tracking for individuals and businesses across Pakistan.</p>
              <div className="flex gap-2">
                {socials.map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
                    className="w-8 h-8 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-brand hover:border-brand transition-colors">
                    {s.icon}
                  </a>
                ))}
              </div>
            </div>
            <div>
              <h5 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wide">Product</h5>
              <ul className="space-y-1.5">
                {['How it works', 'Solutions', 'Packages'].map(l => (
                  <li key={l}><a href={`#${l.toLowerCase().replace(/\s/g, '-')}`} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
                ))}
                <li><Link href="/blog" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wide">Solutions</h5>
              <ul className="space-y-1.5">
                {['Individuals (B2C)', 'Businesses (B2B)', 'SaaS Platform'].map(l => (
                  <li key={l}><a href="#solutions" className="text-xs text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-bold text-gray-900 mb-3 uppercase tracking-wide">Contact</h5>
              <ul className="space-y-1.5">
                <li><span className="text-xs text-gray-500 select-all">support@trackvee.com</span></li>
                <li><span className="text-xs text-gray-500 select-all">sales@trackvee.com</span></li>
                <li><span className="text-xs text-gray-500">Lahore, Pakistan</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-100 py-4 flex flex-wrap justify-between items-center gap-3">
            <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} TrackVee. All rights reserved.</p>
            <p className="text-xs text-gray-400">GPS Vehicle Tracking in Pakistan</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
