import type { PackageItem } from '@/lib/settings';

const DEFAULT_PKGS: PackageItem[] = [
  { name: 'Personal', desc: 'A great starting point for individuals and families.', features: ['Live vehicle tracking', 'Trip history and basic reports', 'Key alerts (ignition, movement)', 'Web and mobile access', '', '', '', ''], featured: false, ctaLabel: 'Request pricing', ctaLink: '#contact' },
  { name: 'Fleet', desc: 'More control and insights for growing businesses.', features: ['Everything in Personal', 'Driver behavior monitoring', 'Geofences and custom alerts', 'Detailed trip and stop reports', 'Multi-vehicle management', '', '', ''], featured: true, ctaLabel: 'Request pricing', ctaLink: '#contact' },
  { name: 'SaaS', desc: 'A flexible platform with advanced requirements.', features: ['Everything in Fleet', 'Custom reporting', 'API access (on request)', 'Multi-location management', 'Dedicated account support', '', '', ''], featured: false, ctaLabel: 'Request pricing', ctaLink: '#contact' },
];

export default function Packages({ packages }: { packages?: PackageItem[] }) {
  const pkgs = packages ?? DEFAULT_PKGS;
  return (
    <>
      {/* Packages */}
      <section id="packages" className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-16 bg-white pt-10">
        <div className="mb-8">
          <span className="text-xs font-bold tracking-widest uppercase text-brand reveal">Choose your plan</span>
          <h1 className="mt-2 text-4xl font-extrabold tracking-tight text-gray-900 leading-tight mb-3 reveal" style={{ transitionDelay: '0.1s' }}>
            Simple, flexible packages for every need.
          </h1>
          <p className="text-base text-gray-500 max-w-xl reveal" style={{ transitionDelay: '0.2s' }}>From personal vehicles to growing fleets and custom SaaS deployments, our packages give you the right features and control.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {pkgs.map((p, i) => (
            <div key={p.name} className={`rounded-2xl p-8 relative border flex flex-col min-h-[560px] reveal ${p.featured ? 'border-brand shadow-[0_0_0_1px_#E02020]' : 'border-gray-200'}`} style={{ transitionDelay: `${0.3 + i * 0.1}s` }}>
              {p.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand text-white text-xs font-bold px-4 py-1 rounded-full whitespace-nowrap">Most popular</span>
              )}
              <h3 className="text-lg font-bold text-gray-900 mb-1.5">{p.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{p.desc}</p>
              <ul className="space-y-1.5 mb-5">
                {(p.features ?? []).filter(f => f.trim()).map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-500">
                    <svg className="w-4 h-4 text-brand mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
                    {f}
                  </li>
                ))}
              </ul>
              <a href={p.ctaLink || '#contact'} className={`block w-full text-center font-semibold py-2.5 rounded-lg text-sm transition-colors mt-auto ${p.featured ? 'bg-brand text-white hover:bg-brand-dark' : 'border border-brand text-brand hover:bg-red-50'}`}>
                {p.ctaLabel || 'Request pricing'}
              </a>
            </div>
          ))}
        </div>
      </section>

    </>
  );
}
