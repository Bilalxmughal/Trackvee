'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { IconDeviceMobile, IconBell, IconMap, IconHistory } from '@tabler/icons-react';

const appFeatures = [
  { icon: <IconMap size={20} stroke={1.8} className="text-brand" />, title: 'Live map', desc: 'See all your vehicles in real time on an interactive map.' },
  { icon: <IconBell size={20} stroke={1.8} className="text-brand" />, title: 'Instant alerts', desc: 'Get push notifications for movement, ignition, and geofence events.' },
  { icon: <IconHistory size={20} stroke={1.8} className="text-brand" />, title: 'Trip history', desc: 'Replay any trip and review full route history on your phone.' },
  { icon: <IconDeviceMobile size={20} stroke={1.8} className="text-brand" />, title: 'Manage anywhere', desc: 'Add vehicles, edit alerts, and share access — all from the app.' },
];

export default function MobileApp() {
  const sectionRef = useRef<HTMLElement>(null);
  const [parallax, setParallax] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      if (!sectionRef.current) return;
      const rect = sectionRef.current.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      setParallax(center * 0.07);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <section ref={sectionRef} id="mobile-app" className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-20 bg-gray-50">

      <div className="flex flex-col lg:flex-row items-center gap-16">

        {/* Left — content */}
        <div className="lg:w-1/2">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-4 reveal">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            Mobile app
          </span>
          <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-5 leading-tight reveal" style={{ transitionDelay: '0.1s' }}>
            Track your vehicles<br />from your pocket.
          </h2>
          <p className="text-gray-500 text-base mb-10 max-w-md leading-relaxed reveal" style={{ transitionDelay: '0.2s' }}>
            The TrackVee mobile app puts live GPS tracking, alerts, and trip history right on your phone — available on Android and iOS.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
            {appFeatures.map((f, i) => (
              <div key={f.title} className="flex gap-3 reveal" style={{ transitionDelay: `${0.3 + i * 0.08}s` }}>
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-0.5">{f.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 reveal" style={{ transitionDelay: '0.65s' }}>
            <a href="https://play.google.com/store" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.18 23.76c.39.22.84.25 1.27.08l11.33-6.54-2.5-2.5-10.1 8.96zm-1.5-20.5c-.1.27-.18.57-.18.9v15.68c0 .33.08.63.18.9l.08.08 8.78-8.78v-.18L1.6 3.18l-.08.08zm15.1 11.24l-2.96-2.96 2.96-2.96c.84.48.84 1.27 0 1.75l-2.96 2.96zM4.45.16C4.02-.01 3.57.02 3.18.24l.08.08 10.1 8.96 2.5-2.5L4.45.16z" />
              </svg>
              <div>
                <p className="text-[10px] text-gray-400 leading-none">GET IT ON</p>
                <p className="text-sm font-bold leading-tight">Google Play</p>
              </div>
            </a>
            <a href="https://apps.apple.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div>
                <p className="text-[10px] text-gray-400 leading-none">DOWNLOAD ON THE</p>
                <p className="text-sm font-bold leading-tight">App Store</p>
              </div>
            </a>
          </div>
        </div>

        {/* Right — real phone screenshot with parallax */}
        <div className="lg:w-1/2 flex justify-center reveal-right" style={{ transitionDelay: '0.15s' }}>
          <div
            className="relative"
            style={{
              transform: `translateY(${parallax}px)`,
              transition: 'transform 0.15s ease-out',
              willChange: 'transform',
            }}
          >
            <div className="absolute -inset-10 bg-brand/10 rounded-[4rem] blur-3xl" />
            <Image
              src="/app-screenshot.webp"
              alt="TrackVee mobile app — live trip history"
              width={310}
              height={636}
              className="relative drop-shadow-2xl"
              priority
            />
          </div>
        </div>

      </div>

    </section>
  );
}
