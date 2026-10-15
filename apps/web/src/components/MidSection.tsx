import {
  IconUsers, IconBuilding, IconTool, IconWorld,
} from '@tabler/icons-react';

const features = [
  {
    title: 'For individuals & families (B2C)',
    desc: 'Stay connected to personal vehicles.',
    icon: <IconUsers size={16} stroke={1.8} className="text-brand" />,
  },
  {
    title: 'For growing businesses (B2B)',
    desc: 'Powerful fleet & operations tools.',
    icon: <IconBuilding size={16} stroke={1.8} className="text-brand" />,
  },
  {
    title: 'Professional installation',
    desc: 'Our team visits and sets up on site.',
    icon: <IconTool size={16} stroke={1.8} className="text-brand" />,
  },
  {
    title: 'Works across Pakistan',
    desc: 'Coverage nationwide, with local support.',
    icon: <IconWorld size={16} stroke={1.8} className="text-brand" />,
  },
];

export default function MidSection() {
  return (
    <section className="py-16 px-8 lg:px-16 bg-white">
      <div className="flex flex-col lg:flex-row gap-12 items-stretch">

        {/* Left image */}
        <div className="lg:w-5/12 rounded-2xl bg-gradient-to-br from-[#1a1a2e] to-[#0f3460] flex items-center justify-center min-h-[300px] lg:min-h-[420px]">
          <div className="text-center text-white/70 px-8">
            <IconTool size={64} stroke={1.2} className="mx-auto mb-4 text-brand opacity-90" />
            <p className="text-sm font-medium">Professional Installation</p>
          </div>
        </div>

        {/* Right text */}
        <div className="lg:w-7/12 flex flex-col justify-center">
          <span className="text-xs font-bold tracking-widest uppercase text-brand">Built for businesses and individuals</span>
          <h2 className="mt-3 mb-4 text-4xl font-extrabold tracking-tight text-gray-900 leading-tight">
            Keep your vehicles moving, with confidence.
          </h2>
          <p className="text-gray-500 text-base mb-8 max-w-lg">
            From personal vehicles to delivery fleets and field teams, TrackVee helps you stay in control with reliable GPS tracking, professional installation and local support.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {features.map(f => (
              <div key={f.title} className="flex gap-3 items-start">
                <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center shrink-0">{f.icon}</div>
                <div>
                  <h5 className="text-sm font-bold text-gray-900 mb-0.5">{f.title}</h5>
                  <p className="text-xs text-gray-500">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
