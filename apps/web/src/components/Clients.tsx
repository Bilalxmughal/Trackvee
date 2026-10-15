import {
  IconTruck, IconBuildingStore, IconSchool, IconBuildingFactory2,
  IconHeartHandshake, IconBuildingSkyscraper, IconPlane, IconCar,
} from '@tabler/icons-react';

const industries = [
  { label: 'Logistics & Delivery', icon: <IconTruck size={24} stroke={1.6} /> },
  { label: 'Retail & Distribution', icon: <IconBuildingStore size={24} stroke={1.6} /> },
  { label: 'Education', icon: <IconSchool size={24} stroke={1.6} /> },
  { label: 'Manufacturing', icon: <IconBuildingFactory2 size={24} stroke={1.6} /> },
  { label: 'Healthcare', icon: <IconHeartHandshake size={24} stroke={1.6} /> },
  { label: 'Corporate Fleets', icon: <IconBuildingSkyscraper size={24} stroke={1.6} /> },
  { label: 'Travel & Tourism', icon: <IconPlane size={24} stroke={1.6} /> },
  { label: 'Personal Vehicles', icon: <IconCar size={24} stroke={1.6} /> },
];

const stats = [
  { value: '500+', label: 'Vehicles tracked' },
  { value: '50+', label: 'Businesses served' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support available' },
];

export default function Clients() {
  return (
    <section className="py-20 px-8 lg:px-16 bg-gray-50">
      <div className="w-full">

        {/* Heading */}
        <div className="text-center mb-12">
          <p className="text-xs font-bold tracking-widest uppercase text-brand mb-3">Trusted by businesses across Pakistan</p>
          <h2 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Built for every industry that moves.
          </h2>
        </div>

        {/* Industry chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-16">
          {industries.map(ind => (
            <div
              key={ind.label}
              className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-full px-5 py-2.5 text-sm font-medium text-gray-600 hover:border-brand hover:text-brand transition-colors cursor-default"
            >
              <span className="text-gray-400">{ind.icon}</span>
              {ind.label}
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 rounded-2xl overflow-hidden">
          {stats.map(s => (
            <div key={s.label} className="bg-white px-8 py-8 text-center">
              <div className="text-4xl font-extrabold text-gray-900 tracking-tight mb-1">{s.value}</div>
              <div className="text-sm text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
