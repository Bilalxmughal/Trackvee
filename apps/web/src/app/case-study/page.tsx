import type { Metadata } from 'next';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { IconTruck, IconMapPin, IconAlertTriangle, IconClock, IconArrowRight, IconCheck } from '@tabler/icons-react';

export const metadata: Metadata = {
  title: 'Case Study: How Rehman Logistics Cut Fuel Costs 22% | TrackVee',
  description: 'See how Rehman Logistics used TrackVee GPS tracking to reduce fuel costs by 22%, recover 2 stolen vehicles, and grow their fleet from 12 to 40 trucks.',
  keywords: 'GPS tracking case study Pakistan, fleet management success story, vehicle tracking ROI',
};

const stats = [
  { value: '22%', label: 'Fuel cost reduction', icon: <IconTruck size={20} stroke={1.8} /> },
  { value: '2', label: 'Stolen vehicles recovered', icon: <IconMapPin size={20} stroke={1.8} /> },
  { value: '40%', label: 'Fewer driver complaints', icon: <IconAlertTriangle size={20} stroke={1.8} /> },
  { value: '3 wks', label: 'Payback period', icon: <IconClock size={20} stroke={1.8} /> },
];

const timeline = [
  {
    phase: 'Before TrackVee',
    heading: 'Flying blind across Pakistan',
    body: `Rehman Logistics was running 12 long-haul trucks between Karachi, Lahore, and Islamabad with zero visibility. Drivers were taking unauthorized stops, fuel cards were being misused, and one vehicle had gone missing for 36 hours before they found out. The owner, Mr. Asif Rehman, was spending 3–4 hours every day calling drivers to get location updates.`,
    color: 'border-gray-200',
    dot: 'bg-gray-300',
  },
  {
    phase: 'Implementation',
    heading: 'TrackVee installed in 4 days',
    body: `TrackVee's installation team visited Lahore and Karachi offices over two weekends. All 12 vehicles were fitted with ATS-GO trackers and the fleet was live on the TrackVee dashboard within 4 days — no downtime, no disruption to active routes. Drivers received a 20-minute briefing on how the app works.`,
    color: 'border-brand',
    dot: 'bg-brand',
  },
  {
    phase: 'First month',
    heading: 'Immediate wins',
    body: `Within the first week, TrackVee's geofence alerts flagged 3 vehicles making unauthorized stops longer than 45 minutes. Fuel card reconciliation revealed a 19% gap between recorded fill-ups and actual GPS distance travelled. One driver was let go after repeated violations. Fuel costs dropped from PKR 2.4M to PKR 1.9M in the first month.`,
    color: 'border-brand',
    dot: 'bg-brand',
  },
  {
    phase: 'Month 3',
    heading: 'Two stolen vehicles recovered',
    body: `A truck parked overnight in Rawalpindi was moved without authorization at 2:17 AM. TrackVee's movement alert fired within 90 seconds. Mr. Rehman called the police with a live location link — the vehicle was recovered 11 km away within 40 minutes. A second theft attempt in Karachi was foiled the following month using the same process.`,
    color: 'border-brand',
    dot: 'bg-brand',
  },
  {
    phase: 'Today',
    heading: 'Fleet grew from 12 to 40 trucks',
    body: `With better visibility and accountability, Rehman Logistics won 3 new corporate contracts they previously couldn't bid on because clients required GPS-verified delivery logs. The fleet grew from 12 to 40 vehicles over 18 months — all fitted with TrackVee from day one.`,
    color: 'border-gray-200',
    dot: 'bg-gray-400',
  },
];

const features = [
  'Live tracking with 30-second refresh',
  'Geofence entry/exit alerts via WhatsApp',
  'Trip history and driver scorecards',
  'Overspeed alerts (>100 km/h)',
  'Unauthorized movement (ignition) alerts',
  'Fuel reconciliation reports',
];

export default function CaseStudyPage() {
  return (
    <>
      <Navbar />
      <main>

        {/* Hero */}
        <section className="bg-white px-8 lg:px-16 py-16 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row gap-12 items-start">
            <div className="lg:w-3/5">
              <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
                Customer story
              </span>
              <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-5 leading-tight">
                How Rehman Logistics cut fuel costs by 22% and recovered 2 stolen trucks.
              </h1>
              <p className="text-gray-500 text-base leading-relaxed max-w-xl mb-6">
                A 12-truck fleet based in Lahore was losing money on unauthorised stops and fuel misuse. Here is exactly what changed after installing TrackVee.
              </p>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">AR</div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Asif Rehman</p>
                  <p className="text-xs text-gray-400">Owner, Rehman Logistics · Lahore</p>
                </div>
              </div>
            </div>

            {/* Stats grid */}
            <div className="lg:w-2/5 grid grid-cols-2 gap-4 w-full">
              {stats.map(s => (
                <div key={s.label} className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                  <div className="text-brand mb-2">{s.icon}</div>
                  <p className="text-3xl font-extrabold text-gray-900 mb-1">{s.value}</p>
                  <p className="text-xs text-gray-500 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="bg-white px-8 lg:px-16 py-14">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-10">The full story</p>
          <div className="relative">
            <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-100 hidden lg:block" />
            <div className="space-y-12 lg:pl-12">
              {timeline.map((t, i) => (
                <div key={i} className="relative">
                  <div className={`absolute -left-12 top-1 w-6 h-6 rounded-full border-2 ${t.color} ${t.dot} hidden lg:flex items-center justify-center`} />
                  <p className="text-[10px] font-bold uppercase tracking-widest text-brand mb-2">{t.phase}</p>
                  <h2 className="text-xl font-extrabold text-gray-900 mb-3">{t.heading}</h2>
                  <p className="text-gray-500 text-sm leading-relaxed max-w-2xl">{t.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quote */}
        <section className="bg-gray-950 px-8 lg:px-16 py-16">
          <div className="max-w-3xl">
            <p className="text-2xl lg:text-3xl font-bold text-white leading-snug mb-6">
              &ldquo;Pehle mera poora din phones mein nikal jaata tha. Ab main subah dashboard kholta hoon, saari trucks ka haal pata chal jaata hai.&rdquo;
            </p>
            <p className="text-sm text-gray-400">Asif Rehman, Owner — Rehman Logistics, Lahore</p>
          </div>
        </section>

        {/* Features used */}
        <section className="bg-white px-8 lg:px-16 py-14 border-b border-gray-100">
          <div className="flex flex-col lg:flex-row gap-12">
            <div className="lg:w-2/5">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Features used</p>
              <h2 className="text-2xl font-extrabold text-gray-900 mb-4 leading-snug">
                Everything in the Standard plan.
              </h2>
              <p className="text-sm text-gray-500 leading-relaxed">
                Rehman Logistics runs on TrackVee&apos;s Standard fleet plan. No custom integrations, no extra hardware — just the platform out of the box.
              </p>
            </div>
            <div className="lg:w-3/5">
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm text-gray-700">
                    <span className="w-5 h-5 rounded-full bg-brand/10 text-brand flex items-center justify-center shrink-0 mt-0.5">
                      <IconCheck size={11} stroke={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-brand px-8 lg:px-16 py-14">
          <div className="flex flex-col lg:flex-row gap-8 items-center justify-between">
            <div>
              <h2 className="text-2xl font-extrabold text-white mb-2">Ready to see this for your fleet?</h2>
              <p className="text-white/70 text-sm">Get a free quote in under 24 hours — no commitment required.</p>
            </div>
            <div className="flex gap-4 shrink-0">
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 bg-white text-brand font-bold text-sm px-6 py-3 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Get a quote <IconArrowRight size={16} stroke={2} />
              </Link>
            </div>
          </div>
        </section>

      </main>

      {/* Footer strip */}
      <div className="bg-white border-t border-gray-100 px-8 lg:px-16 py-5 flex flex-wrap justify-between items-center gap-3">
        <p className="text-xs text-gray-400">&copy; {new Date().getFullYear()} TrackVee. All rights reserved.</p>
        <div className="flex gap-4">
          <Link href="/privacy" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Privacy Policy</Link>
          <Link href="/terms" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Terms of Service</Link>
          <Link href="/contact" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Contact</Link>
          <Link href="/" className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Home</Link>
        </div>
      </div>
    </>
  );
}
