import { IconStarFilled } from '@tabler/icons-react';
import type { ReviewItem } from '@/lib/settings';

const DEFAULT_REVIEWS: ReviewItem[] = [
  { name: 'Ahmed Raza', role: 'Fleet Manager · Karachi', text: 'TrackVee has completely changed how we manage our 40-vehicle fleet. Real-time tracking and alerts have reduced fuel costs by 20% in just 3 months.', rating: 5, initials: 'AR', enabled: true },
  { name: 'Sadia Malik', role: 'Business Owner · Lahore', text: 'Installation was smooth and the platform is very easy to use. Our delivery team is now more accountable and customers get accurate ETAs.', rating: 5, initials: 'SM', enabled: true },
  { name: 'Usman Khan', role: 'Personal vehicle owner · Lahore', text: 'I use TrackVee for my family cars. The alerts when my car moves are a great security feature. Setup was done at my home in under an hour.', rating: 5, initials: 'UK', enabled: true },
  { name: 'Tariq Hussain', role: 'Operations Head · Islamabad', text: 'We track 80+ vehicles across Punjab. The geofence alerts and reports have helped us cut unauthorized trips significantly.', rating: 5, initials: 'TH', enabled: true },
];

export default function Testimonials({ reviews }: { reviews?: ReviewItem[] }) {
  const testimonials = (reviews ?? DEFAULT_REVIEWS).filter(r => r.enabled);
  return (
    <section className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-20 bg-gray-50">

      <div className="text-center mb-14">
        <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center justify-center gap-2 mb-4 reveal">
          <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
          Customer stories
        </span>
        <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-4 reveal" style={{ transitionDelay: '0.1s' }}>
          Trusted by real businesses.
        </h2>
        <p className="text-gray-400 text-base max-w-xl mx-auto reveal" style={{ transitionDelay: '0.2s' }}>
          From personal vehicles to large fleets — here's what our customers say about TrackVee.
        </p>
      </div>

      <div className={`grid grid-cols-1 gap-5 ${testimonials.length > 2 ? 'md:grid-cols-2' : 'md:grid-cols-2 max-w-2xl mx-auto'}`}>
        {testimonials.map((t, i) => (
          <div key={t.name} className="bg-white rounded-2xl p-8 border border-gray-100 flex flex-col gap-5 reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
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
