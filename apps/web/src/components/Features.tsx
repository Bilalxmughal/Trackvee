import {
  IconUsers, IconBuilding, IconTool, IconWorld,
  IconCar, IconTruck, IconBuildingSkyscraper,
} from '@tabler/icons-react';

const pillars = [
  { title: 'For individuals & families (B2C)', desc: 'Stay connected to personal vehicles.', icon: <IconUsers size={17} stroke={1.8} className="text-brand" /> },
  { title: 'For growing businesses (B2B)', desc: 'Powerful fleet & operations tools.', icon: <IconBuilding size={17} stroke={1.8} className="text-brand" /> },
  { title: 'Professional installation', desc: 'Our team visits and sets up on site.', icon: <IconTool size={17} stroke={1.8} className="text-brand" /> },
  { title: 'Works across Pakistan', desc: 'Coverage nationwide, with local support.', icon: <IconWorld size={17} stroke={1.8} className="text-brand" /> },
];

const useCases = [
  {
    title: 'Personal vehicles',
    desc: 'Stay connected to your family vehicles with real-time location and alerts.',
    icon: <IconCar size={28} stroke={1.6} className="text-brand" />,
  },
  {
    title: 'Delivery & logistics',
    desc: 'Keep track of your fleet, improve efficiency and customer service.',
    icon: <IconTruck size={28} stroke={1.6} className="text-brand" />,
  },
  {
    title: 'Growing businesses',
    desc: 'A flexible platform that scales from a few vehicles to large fleets.',
    icon: <IconBuildingSkyscraper size={28} stroke={1.6} className="text-brand" />,
  },
];

export default function Features() {
  return (
    <section className="px-8 lg:px-16 py-16 bg-white">

      {/* Top row: heading left + pillars right */}
      <div className="flex flex-col lg:flex-row gap-10 lg:gap-20 mb-14">

        {/* Left — label + heading + description */}
        <div className="lg:w-1/2">
          <span className="text-xs font-bold tracking-widest uppercase text-brand">Built for businesses and individuals</span>
          <h2 className="mt-3 text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 leading-tight mb-4">
            Keep your vehicles moving, with confidence.
          </h2>
          <p className="text-gray-500 text-base max-w-lg leading-relaxed">
            From personal vehicles to delivery fleets, TrackVee helps you stay in control with reliable GPS tracking, professional installation and local support.
          </p>
        </div>

        {/* Right — 2×2 pillars + buttons */}
        <div className="lg:w-1/2 flex flex-col justify-center">
          <div className="grid grid-cols-2 gap-x-10 gap-y-5 mb-7">
            {pillars.map(f => (
              <div key={f.title} className="flex gap-3 items-start">
                <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center shrink-0 mt-0.5">{f.icon}</div>
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-0.5 leading-snug">{f.title}</h5>
                  <p className="text-xs text-gray-400">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <a href="#packages" className="bg-brand text-white font-semibold px-6 py-3 rounded-md text-sm hover:bg-brand-dark transition-colors">
              View packages
            </a>
            <a href="#contact" className="border border-gray-200 text-gray-800 font-semibold px-6 py-3 rounded-md text-sm hover:border-gray-400 transition-colors">
              Talk to us
            </a>
          </div>
        </div>

      </div>

      {/* Bottom row: 3 large cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {useCases.map(c => (
          <div key={c.title} className="bg-gray-50 rounded-2xl p-8 flex flex-col gap-6">
            <div className="w-14 h-14 rounded-xl bg-red-50 flex items-center justify-center">
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
