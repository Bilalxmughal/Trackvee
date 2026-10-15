import Image from 'next/image';
import Link from 'next/link';

const socials = [
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/company/trackvee',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z"/>
        <circle cx="4" cy="4" r="2"/>
      </svg>
    ),
  },
  {
    label: 'Facebook',
    href: 'https://www.facebook.com/Trackvee',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/>
      </svg>
    ),
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/Trackvee',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
        <path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z"/>
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
      </svg>
    ),
  },
];

export default function Footer() {
  return (
    <footer id="contact" className="bg-white border-t border-gray-100 pt-14 pb-8 px-8 lg:px-16">
      <div className="w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <Link href="#home">
              <Image src="/logo.webp" alt="TrackVee" width={140} height={40} className="h-9 w-auto mb-3" />
            </Link>
            <p className="text-sm text-gray-500 max-w-xs mb-5">Reliable GPS vehicle tracking for individuals and businesses across Pakistan.</p>
            <div className="flex gap-2">
              {socials.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:text-brand hover:border-brand transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Product */}
          <div>
            <h5 className="text-sm font-bold text-gray-900 mb-4">Product</h5>
            <ul className="space-y-2.5">
              {['How it works', 'Solutions', 'Packages'].map(l => (
                <li key={l}><a href={`#${l.toLowerCase().replace(/\s/g, '')}`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Solutions */}
          <div>
            <h5 className="text-sm font-bold text-gray-900 mb-4">Solutions</h5>
            <ul className="space-y-2.5">
              {['Individuals (B2C)', 'Businesses (B2B)', 'SaaS Platform'].map(l => (
                <li key={l}><a href="#solutions" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{l}</a></li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h5 className="text-sm font-bold text-gray-900 mb-4">Contact</h5>
            <ul className="space-y-2.5">
              <li><span className="text-sm text-gray-500 select-all">support@trackvee.com</span></li>
              <li><span className="text-sm text-gray-500 select-all">sales@trackvee.com</span></li>
              <li><span className="text-sm text-gray-500">Lahore, Pakistan</span></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 flex flex-wrap justify-between items-center gap-3">
          <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} TrackVee. All rights reserved.</p>
          <p className="text-xs text-gray-400">GPS Vehicle Tracking in Pakistan</p>
        </div>
      </div>
    </footer>
  );
}
