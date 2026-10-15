const partners = [
  { name: 'Jazz', color: '#E02020', bg: '#fff1f1', abbr: 'Jazz' },
  { name: 'Zong', color: '#7c3aed', bg: '#f5f3ff', abbr: 'Zong' },
  { name: 'Telenor', color: '#0ea5e9', bg: '#f0f9ff', abbr: 'Telenor' },
  { name: 'Teltonika', color: '#15803d', bg: '#f0fdf4', abbr: 'Teltonika' },
  { name: 'Queclink', color: '#1d4ed8', bg: '#eff6ff', abbr: 'Queclink' },
  { name: 'Auto Telematics', color: '#b45309', bg: '#fffbeb', abbr: 'ATS-GO' },
];

export default function Partners() {
  return (
    <section className="py-14 px-8 lg:px-16 bg-white border-t border-gray-100">
      <div className="w-full">
        <p className="text-center text-xs font-bold tracking-widest uppercase text-gray-400 mb-10">
          Our Partners
        </p>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          {partners.map(p => (
            <div
              key={p.name}
              className="flex items-center justify-center rounded-xl border border-gray-100 py-5 px-3 hover:border-gray-200 transition-colors"
              style={{ backgroundColor: p.bg }}
            >
              <span
                className="text-base font-extrabold tracking-tight whitespace-nowrap"
                style={{ color: p.color }}
              >
                {p.abbr}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
