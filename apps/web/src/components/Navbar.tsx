'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useState, useEffect } from 'react';

const links = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Solutions', href: '#solutions' },
  { label: 'Mobile App', href: '#mobile-app' },
  { label: 'Packages', href: '#packages' },
  { label: 'Contact', href: '#contact' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const scrolled = window.scrollY;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(total > 0 ? (scrolled / total) * 100 : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-sm">
      {/* Scroll progress bar */}
      <div className="absolute bottom-0 left-0 h-[2px] bg-brand transition-all duration-100" style={{ width: `${progress}%` }} />

      <div className="w-full px-8 lg:px-16 flex items-center justify-between h-16">
        <Link href="#home">
          <Image src="/logo.webp" alt="TrackVee" width={160} height={48} className="h-12 w-auto mix-blend-multiply" priority />
        </Link>

        {/* Desktop links */}
        <ul className="hidden md:flex items-center gap-8">
          {links.map(l => (
            <li key={l.href}>
              <a href={l.href} className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <a href="#contact" className="hidden md:inline-flex items-center bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-md hover:bg-brand-dark transition-colors">
          Get a quote
        </a>

        {/* Mobile hamburger */}
        <button className="md:hidden p-2" onClick={() => setOpen(!open)} aria-label="Menu">
          <span className={`block w-5 h-0.5 bg-gray-700 mb-1 transition-all ${open ? 'rotate-45 translate-y-1.5' : ''}`} />
          <span className={`block w-5 h-0.5 bg-gray-700 mb-1 ${open ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-0.5 bg-gray-700 transition-all ${open ? '-rotate-45 -translate-y-1.5' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-t border-gray-100 px-5 py-4 flex flex-col gap-4">
          {links.map(l => (
            <a key={l.href} href={l.href} className="text-sm font-medium text-gray-600" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <a href="#contact" className="bg-brand text-white text-sm font-semibold px-5 py-2.5 rounded-md text-center hover:bg-brand-dark transition-colors">
            Get a quote
          </a>
        </div>
      )}
    </nav>
  );
}
