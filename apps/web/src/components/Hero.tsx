import { IconMapPin, IconRoute, IconBell, IconShieldCheck, IconMap, IconTool } from '@tabler/icons-react';

const features = [
  {
    title: 'Live location',
    desc: 'See where your vehicles are in real time, across Pakistan.',
    icon: <IconMapPin size={20} stroke={1.8} className="text-brand" />,
  },
  {
    title: 'Trip history',
    desc: 'Review past trips, routes and stops in a few clicks.',
    icon: <IconRoute size={20} stroke={1.8} className="text-brand" />,
  },
  {
    title: 'Useful alerts',
    desc: 'Get notified about key events so you can act sooner.',
    icon: <IconBell size={20} stroke={1.8} className="text-brand" />,
  },
];

const badges = [
  { label: 'Live tracking 24/7', icon: <IconShieldCheck size={26} stroke={1.8} /> },
  { label: 'Pakistan-wide coverage', icon: <IconMap size={26} stroke={1.8} /> },
  { label: 'Professional setup', icon: <IconTool size={26} stroke={1.8} /> },
];

export default function Hero() {
  return (
    <section
      id="home"
      className="relative flex flex-col"
      style={{ minHeight: 'calc(100vh - 64px)' }}
    >
      {/* Full-height background image — spans main + feature strip */}
      <div className="hidden lg:block absolute right-0 top-0 bottom-0 overflow-hidden" style={{ width: '64%' }}>
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: 'linear-gradient(to right, white 0%, white 18%, rgba(255,255,255,0.6) 34%, transparent 55%)',
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/hero-laptop.webp"
          alt="TrackVee Live Map Dashboard"
          className="w-full h-full object-cover"
          style={{ objectPosition: '45% center' }}
        />
      </div>

      {/* ── Main two-column row ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left: white content */}
        <div className="relative z-10 flex flex-col justify-center px-8 lg:px-16 py-16 w-full lg:w-[43%] bg-white">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-1.5 mb-5 hero-reveal" style={{ animationDelay: '0s' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            GPS Vehicle Tracking in Pakistan
          </span>

          <h1 className="text-5xl xl:text-[4.2rem] font-extrabold leading-[1.06] tracking-tight text-gray-900 mb-6 hero-reveal" style={{ animationDelay: '0.1s' }}>
            Know where every vehicle is.
          </h1>

          <p className="text-xl text-gray-500 mb-9 max-w-[24rem] leading-relaxed hero-reveal" style={{ animationDelay: '0.2s' }}>
            Connect your fleet, track vehicles in real time, and stay in control — from a single car to large fleets.
          </p>

          <div className="flex flex-wrap gap-3 mb-10 hero-reveal" style={{ animationDelay: '0.3s' }}>
            <a href="#packages" className="bg-brand text-white font-semibold px-8 py-4 rounded-md text-base hover:bg-brand-dark transition-colors">
              View packages
            </a>
            <a href="#contact" className="border border-gray-200 text-gray-800 font-semibold px-8 py-4 rounded-md text-base hover:border-gray-400 transition-colors">
              Talk to us
            </a>
          </div>

          <div className="flex flex-wrap gap-6 hero-reveal" style={{ animationDelay: '0.4s' }}>
            {badges.map(b => (
              <div key={b.label} className="flex items-center gap-2 text-base text-gray-400">
                <span className="text-brand">{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Feature strip — bottom, image shows through ── */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`flex gap-4 p-6 bg-white/90 backdrop-blur-sm border-t border-white/60 ${i < 2 ? 'md:border-r border-white/60' : ''} ${i > 0 ? 'border-t md:border-t-0 border-white/60' : ''}`}
          >
            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              {f.icon}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1">{f.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
