import { IconCar, IconTruck, IconBuildingSkyscraper } from '@tabler/icons-react';

const cases = [
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

export default function UseCases() {
  return (
    <section className="px-8 lg:px-16 py-20 bg-gray-50 border-b border-gray-100">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {cases.map(c => (
          <div key={c.title} className="bg-white rounded-2xl p-8 flex flex-col gap-6 border border-gray-100">
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
