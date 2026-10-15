import { IconDeviceMobile, IconBell, IconMap, IconHistory } from '@tabler/icons-react';

const appFeatures = [
  { icon: <IconMap size={20} stroke={1.8} className="text-brand" />, title: 'Live map', desc: 'See all your vehicles in real time on an interactive map.' },
  { icon: <IconBell size={20} stroke={1.8} className="text-brand" />, title: 'Instant alerts', desc: 'Get push notifications for movement, ignition, and geofence events.' },
  { icon: <IconHistory size={20} stroke={1.8} className="text-brand" />, title: 'Trip history', desc: 'Replay any trip and review full route history on your phone.' },
  { icon: <IconDeviceMobile size={20} stroke={1.8} className="text-brand" />, title: 'Manage anywhere', desc: 'Add vehicles, edit alerts, and share access — all from the app.' },
];

export default function MobileApp() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-20 bg-white">

      <div className="flex flex-col lg:flex-row items-center gap-16">

        {/* Left — content */}
        <div className="lg:w-1/2">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            Mobile app
          </span>
          <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-5 leading-tight">
            Track your vehicles<br />from your pocket.
          </h2>
          <p className="text-gray-500 text-base mb-10 max-w-md leading-relaxed">
            The TrackVee mobile app puts live GPS tracking, alerts, and trip history right on your phone — available on Android and iOS.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-10">
            {appFeatures.map(f => (
              <div key={f.title} className="flex gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  {f.icon}
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 mb-0.5">{f.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://play.google.com/store"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3.18 23.76c.39.22.84.25 1.27.08l11.33-6.54-2.5-2.5-10.1 8.96zm-1.5-20.5c-.1.27-.18.57-.18.9v15.68c0 .33.08.63.18.9l.08.08 8.78-8.78v-.18L1.6 3.18l-.08.08zm15.1 11.24l-2.96-2.96 2.96-2.96c.84.48.84 1.27 0 1.75l-2.96 2.96zM4.45.16C4.02-.01 3.57.02 3.18.24l.08.08 10.1 8.96 2.5-2.5L4.45.16z"/>
              </svg>
              <div>
                <p className="text-[10px] text-gray-400 leading-none">GET IT ON</p>
                <p className="text-sm font-bold leading-tight">Google Play</p>
              </div>
            </a>
            <a
              href="https://apps.apple.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors"
            >
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <div>
                <p className="text-[10px] text-gray-400 leading-none">DOWNLOAD ON THE</p>
                <p className="text-sm font-bold leading-tight">App Store</p>
              </div>
            </a>
          </div>
        </div>

        {/* Right — phone mockup */}
        <div className="lg:w-1/2 flex justify-center">
          <div className="relative">
            {/* Glow */}
            <div className="absolute inset-0 bg-brand/10 rounded-[3rem] blur-3xl scale-110" />
            {/* Phone shell */}
            <div className="relative w-64 bg-gray-900 rounded-[3rem] p-3 shadow-2xl">
              <div className="bg-gray-800 rounded-[2.5rem] overflow-hidden">
                {/* Status bar */}
                <div className="bg-gray-900 px-6 pt-3 pb-1 flex justify-between items-center">
                  <span className="text-white text-[10px] font-semibold">9:41</span>
                  <div className="w-20 h-4 bg-gray-900 rounded-full" />
                  <div className="flex gap-1 items-center">
                    <div className="w-3 h-2 border border-white/60 rounded-sm">
                      <div className="w-2 h-full bg-white/60 rounded-sm" />
                    </div>
                  </div>
                </div>
                {/* App header */}
                <div className="bg-brand px-4 py-3 flex items-center justify-between">
                  <span className="text-white text-sm font-bold">TrackVee</span>
                  <IconBell size={16} stroke={2} className="text-white/80" />
                </div>
                {/* Map area */}
                <div className="bg-slate-700 h-40 relative overflow-hidden">
                  {/* Fake map grid */}
                  <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 256 160">
                    {[0,32,64,96,128,160,192,224].map(x => <line key={x} x1={x} y1="0" x2={x} y2="160" stroke="white" strokeWidth="0.5"/>)}
                    {[0,32,64,96,128,160].map(y => <line key={y} x1="0" y1={y} x2="256" y2={y} stroke="white" strokeWidth="0.5"/>)}
                  </svg>
                  {/* Fake roads */}
                  <svg className="absolute inset-0 w-full h-full" viewBox="0 0 256 160">
                    <path d="M 0 80 Q 60 60 128 80 Q 196 100 256 80" stroke="#94a3b8" strokeWidth="3" fill="none"/>
                    <path d="M 100 0 Q 110 80 120 160" stroke="#94a3b8" strokeWidth="2" fill="none"/>
                  </svg>
                  {/* Vehicle marker */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="w-8 h-8 bg-brand rounded-full flex items-center justify-center shadow-lg">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h11a2 2 0 012 2v3m-4 12a3 3 0 106 0 3 3 0 00-6 0m-7 0a3 3 0 106 0 3 3 0 00-6 0"/>
                      </svg>
                    </div>
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-800" />
                  </div>
                </div>
                {/* Vehicle list */}
                <div className="bg-gray-900 px-4 py-3 space-y-2.5">
                  {[
                    { name: 'Toyota Corolla', status: 'Moving', speed: '62 km/h', color: 'text-green-400' },
                    { name: 'Honda Civic', status: 'Parked', speed: 'Gulberg, LHR', color: 'text-gray-400' },
                  ].map(v => (
                    <div key={v.name} className="flex items-center justify-between">
                      <div>
                        <p className="text-white text-xs font-semibold">{v.name}</p>
                        <p className={`text-[10px] ${v.color}`}>{v.status}</p>
                      </div>
                      <p className="text-gray-400 text-[10px]">{v.speed}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

    </section>
  );
}
