const pkgs = [
  {
    name: 'Personal',
    desc: 'A great starting point for individuals and families.',
    features: ['Live vehicle tracking', 'Trip history and basic reports', 'Key alerts (ignition, movement)', 'Web and mobile access'],
    featured: false,
    icon: <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  },
  {
    name: 'Fleet',
    desc: 'More control and insights for growing businesses.',
    features: ['Everything in Personal', 'Driver behavior monitoring', 'Geofences and custom alerts', 'Detailed trip and stop reports', 'Multi-vehicle management'],
    featured: true,
    icon: <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m-4 12a3 3 0 106 0 3 3 0 00-6 0m-7 0a3 3 0 106 0 3 3 0 00-6 0"/><path d="M13 17H9m8 0h3a2 2 0 002-2v-4l-3-4h-4"/></svg>,
  },
  {
    name: 'SaaS',
    desc: 'A flexible platform with advanced requirements.',
    features: ['Everything in Fleet', 'Custom reporting', 'API access (on request)', 'Multi-location management', 'Dedicated account support'],
    featured: false,
    icon: <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
];

const steps = [
  { n: 1, title: 'Get a quote', desc: 'Tell us about your vehicles and requirements.' },
  { n: 2, title: 'Professional installation', desc: 'Our team installs the device at your location.' },
  { n: 3, title: 'Start tracking', desc: 'Log in and see your vehicles live on the map.' },
  { n: 4, title: 'Ongoing support', desc: 'Our team is here to help whenever you need us.' },
];

export default function Packages() {
  return (
    <>
      {/* Packages */}
      <section id="packages" className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-16 bg-white pt-10">
        <div className="mb-8">
          <span className="text-xs font-bold tracking-widest uppercase text-brand">Choose your plan</span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 leading-tight mb-3">
            Simple, flexible packages for every need.
          </h1>
          <p className="text-base text-gray-500 max-w-xl">From personal vehicles to growing fleets and custom SaaS deployments, our packages give you the right features and control.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pkgs.map(p => (
            <div key={p.name} className={`rounded-2xl p-8 relative border flex flex-col min-h-[560px] ${p.featured ? 'border-brand shadow-[0_0_0_1px_#E02020]' : 'border-gray-200'}`}>
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">Most popular</span>
              )}
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${p.featured ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>{p.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1.5">{p.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{p.desc}</p>
              <ul className="space-y-1.5 mb-5">
                {p.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4 text-brand mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href="#contact" className={`block w-full text-center font-semibold py-2.5 rounded-lg text-sm transition-colors mt-auto ${p.featured ? 'bg-brand text-white hover:bg-brand-dark' : 'border border-brand text-brand hover:bg-red-50'}`}>
                Request pricing
              </a>
            </div>
          ))}
        </div>
      </section>

    </>
  );
}
