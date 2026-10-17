import type { SolutionsSettings } from '@/lib/settings';

const DEFAULT_SOLUTIONS: SolutionsSettings = {
  heading: 'One platform for every type of user.',
  description: 'TrackVee is designed for both individuals (B2C) and businesses (B2B), with a reliable platform that adapts to your needs.',
  cards: [
    { heading: 'Individuals (B2C)', subtitle: 'Simple, reliable tracking for personal vehicles. Keep your loved ones safe.', points: ['Real-time location', 'Trip history', 'Movement alerts', 'Easy mobile and web access', '', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
    { heading: 'Businesses (B2B)', subtitle: 'Powerful tools for fleets, delivery operations and field teams.', points: ['Multi-vehicle tracking', 'Driver behavior monitoring', 'Geofences and alerts', 'Detailed reports', 'Team access and permissions', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
    { heading: 'SaaS Platform', subtitle: 'A complete platform for businesses that need flexibility, customization and integration.', points: ['Web-based platform', 'Fleet and user management', 'Custom reports', 'API access (on request)', 'Scales with your business', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
  ],
};

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

export default function Solutions({ solutions }: { solutions?: SolutionsSettings }) {
  const s = solutions ?? DEFAULT_SOLUTIONS;
  return (
    <section id="solutions" className="min-h-screen flex flex-col bg-white">

      {/* Top half — Solutions */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-10">
        <div className="mb-8 max-w-2xl">
          <span className="text-xs font-bold tracking-widest uppercase text-brand">Our Solutions</span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 leading-tight mb-3">{s.heading}</h1>
          <p className="text-base text-gray-500">{s.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {s.cards.map((card, idx) => (
            <div key={idx} className="border border-gray-200 rounded-xl p-6 bg-white flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 mb-2">{card.heading}</h3>
              <p className="text-sm text-gray-500 mb-4">{card.subtitle}</p>
              <ul className="space-y-1.5 mb-5">
                {(card.points ?? []).filter(p => p.trim()).map(point => (
                  <li key={point} className="flex items-start gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4 text-brand mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    {point}
                  </li>
                ))}
              </ul>
              {card.learnMoreUrl && (
                <a
                  href={card.learnMoreUrl}
                  target={card.openExternal ? '_blank' : undefined}
                  rel={card.openExternal ? 'noopener noreferrer' : undefined}
                  className="block w-full bg-brand text-white text-center font-semibold py-2.5 rounded-lg text-sm hover:bg-brand-dark transition-colors mt-auto"
                >
                  {card.learnMoreLabel || 'Learn more'}
                </a>
              )}
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
