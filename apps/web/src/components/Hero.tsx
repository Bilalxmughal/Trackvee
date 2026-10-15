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
  { label: 'Live tracking 24/7', icon: <IconShieldCheck size={15} stroke={1.8} /> },
  { label: 'Pakistan-wide coverage', icon: <IconMap size={15} stroke={1.8} /> },
  { label: 'Professional setup', icon: <IconTool size={15} stroke={1.8} /> },
];

export default function Hero() {
  return (
    <section
      id="home"
      className="relative flex flex-col"
      style={{ minHeight: 'calc(100vh - 64px)' }}
    >
      {/* Main two-column row */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left: white content ── */}
        <div className="relative z-10 flex flex-col justify-center px-8 lg:px-16 py-16 w-full lg:w-[46%] bg-white">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-1.5 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            GPS Vehicle Tracking in Pakistan
          </span>

          <h1 className="text-5xl xl:text-[3.6rem] font-extrabold leading-[1.06] tracking-tight text-gray-900 mb-5">
            Know where every vehicle is.
          </h1>

          <p className="text-lg text-gray-500 mb-8 max-w-[22rem] leading-relaxed">
            Connect your fleet, track vehicles in real time, and stay in control — from a single car to large fleets.
          </p>

          <div className="flex flex-wrap gap-3 mb-10">
            <a href="#packages" className="bg-brand text-white font-semibold px-7 py-3.5 rounded-md text-base hover:bg-brand-dark transition-colors">
              View packages
            </a>
            <a href="#contact" className="border border-gray-200 text-gray-800 font-semibold px-7 py-3.5 rounded-md text-base hover:border-gray-400 transition-colors">
              Talk to us
            </a>
          </div>

          <div className="flex flex-wrap gap-6">
            {badges.map(b => (
              <div key={b.label} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="text-gray-300">{b.icon}</span>
                {b.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: full-height map + floating card ── */}
        <div className="hidden lg:block absolute right-0 top-0 bottom-0" style={{ width: '56%' }}>

          {/* Map background — cropped to show only map area */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'url(/hero-map.webp)',
              backgroundSize: '160%',
              backgroundPosition: '63% 42%',
            }}
          />

          {/* Subtle dark overlay for readability */}
          <div className="absolute inset-0 bg-black/10" />

          {/* Left-side white fade to blend with content */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to right, white 0%, rgba(255,255,255,0.6) 18%, transparent 42%)',
            }}
          />

          {/* ── Floating vehicle card (like Moffu's review card) ── */}
          <div className="absolute top-1/2 -translate-y-1/2 left-14 bg-white rounded-2xl shadow-2xl w-72 overflow-hidden">

            {/* Card header */}
            <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
              <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
                <IconMapPin size={18} stroke={1.8} className="text-brand" />
              </div>
              <span className="font-bold text-gray-900 text-base">Live Location</span>
              <div className="ml-auto flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-600 font-semibold">Live</span>
              </div>
            </div>

            {/* Vehicle info */}
            <div className="mx-5 bg-gray-50 rounded-xl px-4 py-3.5 mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-extrabold text-gray-900">LHR-2048</span>
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">Moving</span>
              </div>
              <div className="text-sm font-semibold text-gray-700 mb-0.5">62 km/h</div>
              <div className="text-xs text-gray-400">Gulberg III, Lahore · Just now</div>
            </div>

            {/* Mini map preview */}
            <div
              className="mx-5 mb-4 h-28 rounded-xl overflow-hidden relative"
              style={{
                backgroundImage: 'url(/hero-map.webp)',
                backgroundSize: '320%',
                backgroundPosition: '56% 38%',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 bg-brand rounded-full shadow-lg ring-2 ring-white" />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 px-5 pb-5">
              <a href="#" className="flex-1 bg-brand text-white text-sm font-semibold py-2.5 rounded-xl text-center hover:bg-brand-dark transition-colors">
                View Map
              </a>
              <a href="#" className="flex-1 border border-gray-200 text-gray-700 text-sm font-semibold py-2.5 rounded-xl text-center hover:border-gray-300 transition-colors">
                History
              </a>
            </div>
          </div>
        </div>

      </div>

      {/* ── Feature strip — bottom of viewport ── */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 border-t border-gray-100 bg-white">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`flex gap-4 p-6 ${i < 2 ? 'md:border-r border-gray-100' : ''} ${i > 0 ? 'border-t md:border-t-0 border-gray-100' : ''}`}
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
