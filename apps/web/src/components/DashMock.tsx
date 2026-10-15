import Image from 'next/image';

const vehicles = [
  { id: 'LHR-2468', status: 'moving', speed: '72 km/h', style: { top: '22%', left: '20%' } },
  { id: 'ISB-4821', status: 'idle',   speed: '0 km/h',  style: { top: '50%', left: '52%' } },
  { id: 'KHI-3164', status: 'parked', speed: '0 km/h',  style: { top: '68%', left: '24%' } },
  { id: 'FSD-5802', status: 'moving', speed: '35 km/h', style: { top: '38%', left: '70%' } },
];

const statusColor: Record<string, string> = {
  moving: 'bg-green-500',
  idle: 'bg-amber-400',
  parked: 'bg-gray-500',
};

export default function DashMock() {
  return (
    <div className="rounded-xl border border-gray-200 shadow-xl overflow-hidden text-[11px] bg-white">
      {/* Topbar */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 bg-white">
        <Image src="/logo.webp" alt="TrackVee" width={90} height={26} className="h-6 w-auto" />
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1.5 text-gray-400 flex items-center gap-1.5">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          Search vehicle, driver or location...
        </div>
      </div>

      <div className="flex" style={{ height: 340 }}>
        {/* Sidebar */}
        <div className="w-36 bg-white border-r border-gray-100 py-2 shrink-0">
          {['Live Tracking','Vehicles','Trip History','Geofences','Alerts','Reports','Settings'].map((item, i) => (
            <div key={item} className={`px-3 py-1.5 flex items-center gap-2 cursor-pointer ${i === 0 ? 'text-brand bg-red-50 font-semibold' : 'text-gray-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-brand' : 'bg-gray-300'}`} />
              {item}
            </div>
          ))}
        </div>

        {/* Map */}
        <div className="flex-1 relative overflow-hidden" style={{ background: 'linear-gradient(135deg,#e8f0e0,#d4e8c4 40%,#c8deb8 70%,#d8e8d0)' }}>
          {/* Grid lines */}
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.04) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
          {/* Roads */}
          <div className="absolute left-0 right-0 h-2 bg-white/70 rounded-sm" style={{ top: '44%' }} />
          <div className="absolute top-0 bottom-0 w-2 bg-white/70 rounded-sm" style={{ left: '39%' }} />
          <div className="absolute top-0 bottom-0 w-1.5 bg-white/50 rounded-sm" style={{ left: '64%' }} />
          {/* Label */}
          <div className="absolute text-[13px] font-bold text-black/30" style={{ top: '36%', left: '41%' }}>Lahore</div>
          {/* Pins */}
          {vehicles.map(v => (
            <div key={v.id} className={`absolute w-7 h-7 rounded-md ${statusColor[v.status]} flex items-center justify-center text-white text-[9px] font-bold shadow-md cursor-pointer`} style={v.style}>
              {v.status === 'parked' ? '🅿' : '🚗'}
            </div>
          ))}
        </div>

        {/* Panel */}
        <div className="w-40 bg-white border-l border-gray-100 flex flex-col shrink-0">
          <div className="px-3 py-2 border-b border-gray-100 font-bold">LHR-2468</div>
          <div className="flex border-b border-gray-100">
            {['Live','Trips','Alerts'].map((t, i) => (
              <div key={t} className={`flex-1 text-center py-1.5 text-[10px] cursor-pointer ${i === 0 ? 'text-brand border-b-2 border-brand font-semibold' : 'text-gray-400'}`}>{t}</div>
            ))}
          </div>
          <div className="p-2.5 flex-1 overflow-auto">
            <div className="flex items-center gap-1 text-green-500 font-semibold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Online
            </div>
            {[['Speed','72 km/h'],['Ignition','On'],['Driver','Ahmed K.'],['Time','10:24 AM']].map(([k,v]) => (
              <div key={k} className="flex justify-between mb-1.5">
                <span className="text-gray-400">{k}</span>
                <span className="font-semibold text-gray-800">{v}</span>
              </div>
            ))}
            <p className="text-gray-400 text-[9px] mt-1.5">Main Blvd, Gulberg, Lahore</p>
            <button className="mt-2 w-full bg-brand text-white rounded-md py-1.5 text-[10px] font-bold">View trip history</button>
          </div>
        </div>
      </div>
    </div>
  );
}
