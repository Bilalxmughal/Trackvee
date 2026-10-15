import { IconMapPin, IconRoute, IconBell } from '@tabler/icons-react';

const features = [
  {
    title: 'Live location',
    desc: 'See where your vehicles are in real time, across Pakistan.',
    icon: <IconMapPin size={26} stroke={1.8} className="text-brand" />,
  },
  {
    title: 'Trip history',
    desc: 'Review past trips, routes and stops in a few clicks.',
    icon: <IconRoute size={26} stroke={1.8} className="text-brand" />,
  },
  {
    title: 'Useful alerts',
    desc: 'Get notified about key events so you can act sooner.',
    icon: <IconBell size={26} stroke={1.8} className="text-brand" />,
  },
];

export default function Hero() {
  return (
    <section
      id="home"
      className="flex flex-col px-8 lg:px-16"
      style={{ minHeight: 'calc(100vh - 64px)' }}
    >
      {/* Hero content */}
      <div className="flex-1 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 xl:gap-14 items-center py-12">

          {/* Left */}
          <div>
            <span className="text-xs font-bold tracking-widest uppercase text-brand">
              GPS Vehicle Tracking in Pakistan
            </span>
            <h1 className="mt-3 mb-5 text-5xl xl:text-6xl font-extrabold leading-[1.06] tracking-tight text-gray-900">
              Know where every vehicle is.
            </h1>
            <p className="text-lg text-gray-500 mb-8 max-w-md">
              Live tracking, trip history and alerts for the vehicles your business or family depends on.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href="#packages" className="bg-brand text-white font-semibold px-7 py-3.5 rounded-md text-base hover:bg-brand-dark transition-colors">
                View packages
              </a>
              <a href="#contact" className="border border-gray-200 text-gray-800 font-semibold px-7 py-3.5 rounded-md text-base hover:border-gray-400 transition-colors">
                Talk to us
              </a>
            </div>
            <div className="flex flex-wrap gap-7 mt-10">
              {[
                'Track vehicles across Pakistan',
                'Simple platform for your team',
                'Reliable hardware & local support',
              ].map(b => (
                <div key={b} className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-300 shrink-0" />
                  {b}
                </div>
              ))}
            </div>
          </div>

          {/* Right — laptop mockup */}
          <div className="hidden lg:flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/hero-laptop.webp"
              alt="TrackVee Live Map Dashboard"
              className="w-full max-w-2xl object-contain drop-shadow-2xl"
            />
          </div>
        </div>
      </div>

      {/* Feature strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 border-t border-gray-100">
        {features.map((f, i) => (
          <div
            key={f.title}
            className={`flex gap-5 p-7 ${i < 2 ? 'md:border-r border-gray-100' : ''} ${i > 0 ? 'border-t md:border-t-0 border-gray-100' : ''}`}
          >
            <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
              {f.icon}
            </div>
            <div>
              <h4 className="font-bold text-gray-900 mb-1.5 text-base">{f.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
