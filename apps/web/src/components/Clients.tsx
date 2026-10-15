'use client';
import {
  IconTruck, IconBuildingStore, IconSchool, IconBuildingFactory2,
  IconHeartHandshake, IconBuildingSkyscraper, IconPlane, IconCar,
} from '@tabler/icons-react';

const stats = [
  { value: '500+', label: 'Vehicles tracked' },
  { value: '50+', label: 'Businesses served' },
  { value: '99.9%', label: 'Uptime' },
  { value: '24/7', label: 'Support available' },
];

const industries = [
  { label: 'Logistics & Delivery', icon: <IconTruck size={22} stroke={1.4} /> },
  { label: 'Retail & Distribution', icon: <IconBuildingStore size={22} stroke={1.4} /> },
  { label: 'Education', icon: <IconSchool size={22} stroke={1.4} /> },
  { label: 'Manufacturing', icon: <IconBuildingFactory2 size={22} stroke={1.4} /> },
  { label: 'Healthcare', icon: <IconHeartHandshake size={22} stroke={1.4} /> },
  { label: 'Corporate Fleets', icon: <IconBuildingSkyscraper size={22} stroke={1.4} /> },
  { label: 'Travel & Tourism', icon: <IconPlane size={22} stroke={1.4} /> },
  { label: 'Personal Vehicles', icon: <IconCar size={22} stroke={1.4} /> },
];

const partners = [
  { name: 'Jazz', logo: 'https://logo.clearbit.com/jazz.com.pk' },
  { name: 'Zong', logo: 'https://logo.clearbit.com/zong.com.pk' },
  { name: 'Telenor', logo: 'https://logo.clearbit.com/telenor.com.pk' },
  { name: 'Teltonika', logo: 'https://logo.clearbit.com/teltonika.com' },
  { name: 'Queclink', logo: 'https://logo.clearbit.com/queclink.com' },
  { name: 'Auto Telematics', logo: 'https://logo.clearbit.com/autotelematics.com' },
];

const row1 = [...partners, ...partners];
const row2 = [...partners, ...partners];

function LogoImg({ name, logo }: { name: string; logo: string }) {
  return (
    <div className="flex items-center justify-center shrink-0 px-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo}
        alt={name}
        className="h-10 max-w-[130px] object-contain grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all"
        onError={(e) => {
          const t = e.currentTarget;
          t.style.display = 'none';
          if (t.nextSibling) (t.nextSibling as HTMLElement).style.display = 'block';
        }}
      />
      <span className="hidden text-sm font-bold text-gray-400">{name}</span>
    </div>
  );
}

export default function Clients() {
  return (
    <section className="min-h-screen flex flex-col">

      {/* Top half — white */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 py-16 bg-white">

        <div className="text-center mb-10">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center justify-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            Trusted by businesses across Pakistan
          </span>
          <h2 className="text-3xl xl:text-[2.4rem] font-extrabold tracking-tight text-gray-900 mb-4">
            Built for every industry that moves.
          </h2>
          <p className="text-gray-400 text-base max-w-xl mx-auto">
            From courier companies to schools, manufacturers to retailers — TrackVee powers fleets across Pakistan.
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-x-14 gap-y-6 mb-10">
          {industries.map(ind => (
            <div key={ind.label} className="flex flex-col items-center gap-2 text-gray-400 hover:text-brand transition-colors cursor-default">
              {ind.icon}
              <span className="text-xs font-medium text-gray-400">{ind.label}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100 rounded-2xl overflow-hidden">
          {stats.map(s => (
            <div key={s.label} className="bg-white px-6 py-5 text-center">
              <div className="text-2xl font-extrabold text-gray-900 tracking-tight mb-0.5">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          ))}
        </div>

      </div>

      {/* Divider — Our Partners sits exactly at the boundary */}
      <div className="flex items-center gap-4 px-8 lg:px-16 py-0">
        <div className="h-px flex-1 bg-gray-200" />
        <span className="text-xs font-bold tracking-widest uppercase text-gray-400">Our Partners</span>
        <div className="h-px flex-1 bg-gray-200" />
      </div>

      {/* Bottom half */}
      <div className="flex-1 flex flex-col justify-center px-8 lg:px-16 pt-8 pb-16 bg-white">


        <div className="flex flex-col gap-6 overflow-hidden">
          <div className="overflow-hidden">
            <div className="flex items-center marquee-track" style={{ width: 'max-content' }}>
              {row1.map((p, i) => <LogoImg key={`r1-${p.name}-${i}`} {...p} />)}
            </div>
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center marquee-track" style={{ width: 'max-content', animationDuration: '36s' }}>
              {row2.map((p, i) => <LogoImg key={`r2-${p.name}-${i}`} {...p} />)}
            </div>
          </div>
        </div>

      </div>

    </section>
  );
}
