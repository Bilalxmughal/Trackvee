import { IconStarFilled } from '@tabler/icons-react';

const testimonials = [
  {
    name: 'Ahmed Raza',
    role: 'Fleet Manager, Speedex Logistics',
    text: 'TrackVee has completely changed how we manage our 40-vehicle fleet. Real-time tracking and alerts have reduced fuel costs by 20% in just 3 months.',
    rating: 5,
    initials: 'AR',
  },
  {
    name: 'Sadia Malik',
    role: 'Owner, Al-Fatah Retail',
    text: 'Installation was smooth and the platform is very easy to use. Our delivery team is now more accountable and customers get accurate ETAs.',
    rating: 5,
    initials: 'SM',
  },
  {
    name: 'Usman Khan',
    role: 'Personal vehicle owner, Lahore',
    text: 'I use TrackVee for my family cars. The alerts when my car moves are a great security feature. Setup was done at my home in under an hour.',
    rating: 5,
    initials: 'UK',
  },
  {
    name: 'Tariq Hussain',
    role: 'Operations Head, Metro Distribution',
    text: 'We track 80+ vehicles across Punjab. The geofence alerts and reports have helped us cut unauthorized trips significantly.',
    rating: 5,
    initials: 'TH',
  },
];

export default function Testimonials() {
  return (
    <section className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-20 bg-gray-50">

      <div className="text-center mb-14">
        <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center justify-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
          Customer stories
        </span>
        <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
          Trusted by real businesses.
        </h2>
        <p className="text-gray-400 text-base max-w-xl mx-auto">
          From personal vehicles to large fleets — here's what our customers say about TrackVee.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {testimonials.map(t => (
          <div key={t.name} className="bg-white rounded-2xl p-8 border border-gray-100 flex flex-col gap-5">
            <div className="flex gap-0.5">
              {Array.from({ length: t.rating }).map((_, i) => (
                <IconStarFilled key={i} size={16} className="text-amber-400" />
              ))}
            </div>
            <p className="text-gray-600 text-base leading-relaxed flex-1">"{t.text}"</p>
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <div className="w-10 h-10 rounded-full bg-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
                {t.initials}
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">{t.name}</p>
                <p className="text-xs text-gray-400">{t.role}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

    </section>
  );
}
