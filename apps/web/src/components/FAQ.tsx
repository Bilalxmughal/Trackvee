'use client';
import { useState } from 'react';
import { IconPlus, IconMinus } from '@tabler/icons-react';

const faqs = [
  {
    q: 'How long does installation take?',
    a: 'Professional installation takes 30–60 minutes per vehicle. Our technician visits your location and handles everything — no downtime needed.',
  },
  {
    q: 'Is there a long-term contract?',
    a: 'No long-term contracts. Our plans are flexible — pay monthly and cancel anytime. We believe in earning your loyalty through service, not lock-in.',
  },
  {
    q: 'Which networks does the device use?',
    a: 'Our devices support all major Pakistani networks (Jazz, Zong, Ufone, Telenor) and automatically switch to the strongest signal for uninterrupted tracking.',
  },
  {
    q: 'Can I track multiple vehicles from one account?',
    a: 'Yes. You can add unlimited vehicles to a single account and manage them all from one dashboard or the mobile app.',
  },
  {
    q: 'What happens if the device loses connection?',
    a: 'The device stores data locally when offline and syncs automatically once connectivity is restored. You will not lose any trip history.',
  },
  {
    q: 'Is the platform accessible from mobile?',
    a: 'Yes — TrackVee has a dedicated mobile app for Android and iOS, with live tracking, alerts, and full trip history available on your phone.',
  },
  {
    q: 'Do you offer a free trial or demo?',
    a: 'Yes. Contact our team and we will set up a live demo for you. We can also run a pilot on one vehicle before you commit to your full fleet.',
  },
  {
    q: 'What kind of support do you provide?',
    a: 'We offer WhatsApp, phone, and email support Mon–Sat 9am–6pm. For fleet customers, a dedicated account manager is available.',
  },
];

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null);

  return (
    <section className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-20 bg-gray-50">

      <div className="flex flex-col lg:flex-row gap-16 items-start">

        {/* Left — heading */}
        <div className="lg:w-1/3 lg:sticky lg:top-24">
          <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
            FAQ
          </span>
          <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-5 leading-tight">
            Common questions.
          </h2>
          <p className="text-gray-500 text-base leading-relaxed mb-8">
            Everything you need to know before getting started with TrackVee.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 bg-brand text-white font-semibold px-6 py-3 rounded-xl text-sm hover:bg-brand-dark transition-colors"
          >
            Still have questions? Contact us
          </a>
        </div>

        {/* Right — accordion */}
        <div className="lg:w-2/3 w-full space-y-3">
          {faqs.map((f, i) => (
            <div
              key={i}
              className={`bg-white rounded-2xl border transition-colors ${open === i ? 'border-brand/30' : 'border-gray-100'}`}
            >
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
              >
                <span className="text-sm font-bold text-gray-900 pr-4">{f.q}</span>
                <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${open === i ? 'bg-brand text-white' : 'bg-gray-100 text-gray-500'}`}>
                  {open === i
                    ? <IconMinus size={14} stroke={2.5} />
                    : <IconPlus size={14} stroke={2.5} />
                  }
                </span>
              </button>
              {open === i && (
                <div className="px-6 pb-5">
                  <p className="text-sm text-gray-500 leading-relaxed">{f.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>

      </div>

    </section>
  );
}
