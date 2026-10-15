const plans = [
  {
    title: 'Individuals (B2C)',
    desc: 'Simple, reliable tracking for personal vehicles. Keep your loved ones safe.',
    checks: ['Real-time location', 'Trip history', 'Movement alerts', 'Easy mobile and web access'],
    icon: (
      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
  {
    title: 'Businesses (B2B)',
    desc: 'Powerful tools for fleets, delivery operations and field teams.',
    checks: ['Multi-vehicle tracking', 'Driver behavior monitoring', 'Geofences and alerts', 'Detailed reports', 'Team access and permissions'],
    icon: (
      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>
      </svg>
    ),
  },
  {
    title: 'SaaS Platform',
    desc: 'A complete platform for businesses that need flexibility, customization and integration.',
    checks: ['Web-based platform', 'Fleet and user management', 'Custom reports', 'API access (on request)', 'Scales with your business'],
    icon: (
      <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
];

const whys = [
  {
    title: 'Reliable hardware',
    desc: 'Quality devices with local support.',
    icon: <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  },
  {
    title: 'Easy installation',
    desc: 'Professional setup at your location.',
    icon: <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  },
  {
    title: 'Scalable platform',
    desc: 'From a single vehicle to large fleets.',
    icon: <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    title: 'Ongoing support',
    desc: 'Local team ready to help when you need us.',
    icon: <svg className="w-6 h-6 text-brand" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.67A2 2 0 012 1h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/></svg>,
  },
];

export default function Solutions() {
  return (
    <section id="solutions" className="min-h-screen flex flex-col bg-white">

      {/* Top half — Solutions */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-10">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-bold tracking-widest uppercase text-brand">Our Solutions</span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 leading-tight mb-3">
            One platform for every type of user.
          </h1>
          <p className="text-base text-gray-500">TrackVee is designed for both individuals (B2C) and businesses (B2B), with a reliable platform that adapts to your needs.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(p => (
            <div key={p.title} className="border border-gray-200 rounded-xl p-6 bg-white flex flex-col">
              <div className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center mb-4">{p.icon}</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{p.title}</h3>
              <p className="text-sm text-gray-500 mb-4">{p.desc}</p>
              <ul className="space-y-1.5 mb-5">
                {p.checks.map(c => (
                  <li key={c} className="flex items-start gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4 text-brand mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    {c}
                  </li>
                ))}
              </ul>
              <a href="#contact" className="block w-full bg-brand text-white text-center font-semibold py-2.5 rounded-lg text-sm hover:bg-brand-dark transition-colors mt-auto">Learn more</a>
            </div>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-4 px-8 lg:px-16">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Why choose TrackVee?</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Bottom half — Why TrackVee */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 pt-8 pb-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {whys.map(w => (
            <div key={w.title} className="text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">{w.icon}</div>
              <h4 className="font-bold text-gray-900 mb-1.5">{w.title}</h4>
              <p className="text-sm text-gray-500">{w.desc}</p>
            </div>
          ))}
        </div>
      </div>

    </section>
  );
}
