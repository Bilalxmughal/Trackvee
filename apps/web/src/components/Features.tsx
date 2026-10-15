import {
  IconUsers, IconBuilding, IconTool, IconWorld,
  IconCar, IconTruck, IconBuildingSkyscraper,
} from '@tabler/icons-react';

const pillars = [
  { title: 'For individuals & families', desc: 'Stay connected to your personal vehicles anytime, anywhere.', icon: <IconUsers size={20} stroke={1.8} className="text-brand" /> },
  { title: 'For growing businesses', desc: 'Powerful fleet tools built for operations at any scale.', icon: <IconBuilding size={20} stroke={1.8} className="text-brand" /> },
  { title: 'Professional installation', desc: 'Our team visits your location and sets everything up.', icon: <IconTool size={20} stroke={1.8} className="text-brand" /> },
  { title: 'Works across Pakistan', desc: 'Nationwide coverage with dedicated local support.', icon: <IconWorld size={20} stroke={1.8} className="text-brand" /> },
];

const cases = [
  {
    title: 'Personal vehicles',
    desc: 'Stay connected to your family vehicles with real-time location, speed alerts and trip history — all from your phone.',
    icon: <IconCar size={32} stroke={1.6} className="text-brand" />,
  },
  {
    title: 'Delivery & logistics',
    desc: 'Track your entire fleet live, assign routes, monitor stops and improve delivery efficiency across your operations.',
    icon: <IconTruck size={32} stroke={1.6} className="text-brand" />,
  },
  {
    title: 'Growing businesses',
    desc: 'A flexible platform built to scale — whether you have 3 vehicles or 300, TrackVee grows with your business.',
    icon: <IconBuildingSkyscraper size={32} stroke={1.6} className="text-brand" />,
  },
];

export default function Features() {
  return (
    <section className="min-h-screen flex flex-col justify-between px-8 lg:px-16 py-24 bg-gray-50">

      {/* Top: heading + pillars */}
      <div className="flex flex-col lg:flex-row gap-12 lg:gap-24 mb-16">

        {/* Left — label + heading + description + buttons */}
        <div className="lg:w-1/2 flex flex-col justify-center">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            Built for businesses and individuals
          </span>
          <h2 className="text-4xl xl:text-[3.2rem] font-extrabold tracking-tight text-gray-900 leading-[1.08] mb-5">
            Keep your vehicles moving, with confidence.
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-8 max-w-md">
            From personal vehicles to delivery fleets, TrackVee helps you stay in control with reliable GPS tracking, professional installation and local support.
          </p>
          <div className="flex gap-3">
            <a href="#packages" className="bg-brand text-white font-semibold px-7 py-3.5 rounded-md text-sm hover:bg-brand-dark transition-colors">
              View packages
            </a>
            <a href="#contact" className="border border-gray-300 text-gray-800 font-semibold px-7 py-3.5 rounded-md text-sm hover:border-gray-400 transition-colors">
              Talk to us
            </a>
          </div>
        </div>

        {/* Right — 2×2 pillars */}
        <div className="lg:w-1/2 grid grid-cols-2 gap-4">
          {pillars.map(f => (
            <div key={f.title} className="bg-white rounded-2xl p-6 border border-gray-100 flex flex-col gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                {f.icon}
              </div>
              <div>
                <h5 className="text-sm font-bold text-gray-900 mb-1 leading-snug">{f.title}</h5>
                <p className="text-xs text-gray-400 leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Divider label */}
      <div className="flex items-center gap-4 mb-8">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Who uses TrackVee</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Bottom: use case cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cases.map(c => (
          <div key={c.title} className="bg-white rounded-2xl p-8 flex flex-col gap-5 border border-gray-100">
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
              {c.icon}
            </div>
            <div>
              <h4 className="text-xl font-extrabold text-gray-900 mb-2">{c.title}</h4>
              <p className="text-sm text-gray-500 leading-relaxed">{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
