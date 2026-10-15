'use client';
import { useState } from 'react';
import { IconPhone, IconMail, IconMapPin, IconBrandWhatsapp, IconSend, IconClock } from '@tabler/icons-react';

const info = [
  {
    icon: <IconBrandWhatsapp size={22} stroke={1.8} className="text-brand" />,
    label: 'WhatsApp',
    value: '+92 300 0000000',
    href: 'https://wa.me/923000000000',
    sub: 'Fastest response',
  },
  {
    icon: <IconPhone size={22} stroke={1.8} className="text-brand" />,
    label: 'Phone',
    value: '+92 300 0000000',
    href: 'tel:+923000000000',
    sub: 'Mon – Sat, 9am – 6pm',
  },
  {
    icon: <IconMail size={22} stroke={1.8} className="text-brand" />,
    label: 'Email',
    value: 'sales@trackvee.com',
    href: 'mailto:sales@trackvee.com',
    sub: 'Reply within 24 hours',
  },
  {
    icon: <IconMapPin size={22} stroke={1.8} className="text-brand" />,
    label: 'Location',
    value: 'Lahore, Pakistan',
    href: null,
    sub: 'Serving nationwide',
  },
];

export default function Contact() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', vehicles: '', type: '', contactTypes: [] as string[], message: '' });
  const [errors, setErrors] = useState({ phone: '', email: '' });

  const phoneDigits = (v: string) => v.replace(/\D/g, '');

  const handlePhone = (v: string) => {
    const digits = phoneDigits(v);
    if (digits.length > 10) return;
    setForm(f => ({ ...f, phone: v.replace(/[^\d\s]/g, '') }));
    setErrors(e => ({ ...e, phone: digits.length > 0 && digits.length < 10 ? 'Enter a valid 10-digit number' : '' }));
  };

  const handleEmail = (v: string) => {
    setForm(f => ({ ...f, email: v }));
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    setErrors(e => ({ ...e, email: v && !valid ? 'Enter a valid email address' : '' }));
  };

  const toggleContactType = (t: string) => {
    setForm(f => ({
      ...f,
      contactTypes: f.contactTypes.includes(t) ? f.contactTypes.filter(x => x !== t) : [...f.contactTypes, t],
    }));
  };

  return (
    <section id="contact" className="min-h-screen flex flex-col justify-center px-8 lg:px-16 py-20 bg-white">

      {/* Heading */}
      <div className="mb-12">
        <span className="text-xs font-bold tracking-widest uppercase text-brand flex items-center gap-2 mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-brand inline-block" />
          Get in touch
        </span>
        <h2 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-gray-900 mb-4">
          Let's get your vehicles online.
        </h2>
        <p className="text-gray-500 text-base max-w-lg">
          Fill in the form and our team will reach out within 24 hours — or contact us directly via WhatsApp or phone.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-16">

        {/* Left — form */}
        <div className="lg:w-3/5">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Send us a message</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 mb-2">
            <div className="border-b border-gray-200 focus-within:border-brand transition-colors py-3">
              <label className="text-xs text-gray-400 block mb-1">Full name</label>
              <input
                type="text"
                placeholder="Muhammad Ali"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                className="w-full text-sm text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
              />
            </div>
            <div className={`border-b transition-colors py-3 ${errors.phone ? 'border-red-400' : 'border-gray-200 focus-within:border-brand'}`}>
              <label className="text-xs text-gray-400 block mb-1">Phone number</label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-400 shrink-0">+92</span>
                <input
                  type="tel"
                  placeholder="300 1234567"
                  value={form.phone}
                  onChange={e => handlePhone(e.target.value)}
                  maxLength={12}
                  className="flex-1 text-sm text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
                />
              </div>
              {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
            </div>
            <div className={`border-b transition-colors py-3 ${errors.email ? 'border-red-400' : 'border-gray-200 focus-within:border-brand'}`}>
              <label className="text-xs text-gray-400 block mb-1">Email address</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={e => handleEmail(e.target.value)}
                className="w-full text-sm text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent"
              />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </div>
            <div className="border-b border-gray-200 focus-within:border-brand transition-colors py-3">
              <label className="text-xs text-gray-400 block mb-1">I am a</label>
              <select
                value={form.type}
                onChange={e => setForm({ ...form, type: e.target.value, vehicles: '' })}
                className="w-full text-sm text-gray-900 focus:outline-none bg-transparent appearance-none cursor-pointer"
              >
                <option value="">Select type</option>
                <option value="Individual">Individual</option>
                <option value="Business">Business / Fleet</option>
              </select>
            </div>
            {form.type === 'Business' && (
              <div className="sm:col-span-2 border-b border-gray-200 focus-within:border-brand transition-colors py-3">
                <label className="text-xs text-gray-400 block mb-1">Number of vehicles</label>
                <select
                  value={form.vehicles}
                  onChange={e => setForm({ ...form, vehicles: e.target.value })}
                  className="w-full text-sm text-gray-900 focus:outline-none bg-transparent appearance-none cursor-pointer"
                >
                  <option value="">Select range</option>
                  <option value="1-5">1 – 5 vehicles</option>
                  <option value="6-20">6 – 20 vehicles</option>
                  <option value="21-50">21 – 50 vehicles</option>
                  <option value="50+">50+ vehicles</option>
                </select>
              </div>
            )}
            <div className="sm:col-span-2 pt-5">
              <label className="text-xs text-gray-400 block mb-3">Preferred contact method</label>
              <div className="flex gap-2 flex-wrap">
                {['Call', 'WhatsApp', 'Email'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleContactType(t)}
                    className={`px-4 py-1.5 text-xs font-semibold border rounded-lg transition-colors ${
                      form.contactTypes.includes(t)
                        ? 'border-brand text-brand'
                        : 'border-gray-200 text-gray-400 hover:border-brand hover:text-brand'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="border-b border-gray-200 focus-within:border-brand transition-colors py-3 mb-8">
            <label className="text-xs text-gray-400 block mb-1">Message (optional)</label>
            <textarea
              rows={3}
              placeholder="Tell us about your requirements..."
              value={form.message}
              onChange={e => setForm({ ...form, message: e.target.value })}
              className="w-full text-sm text-gray-900 placeholder-gray-300 focus:outline-none bg-transparent resize-none"
            />
          </div>
          <button className="flex items-center gap-2 bg-brand text-white font-semibold px-8 py-3 text-sm rounded-lg hover:bg-brand-dark transition-colors">
            <IconSend size={15} stroke={2} />
            Send message
          </button>
        </div>

        {/* Right — flat contact info */}
        <div className="lg:w-2/5 flex flex-col justify-center">

          <p className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-6">Contact details</p>

          <div className="divide-y divide-gray-100">
            {info.map(i => (
              <div key={i.label} className="flex items-center gap-4 py-5">
                <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                  {i.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400 mb-0.5">{i.label}</p>
                  {i.href ? (
                    <a href={i.href} target={i.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                      className="text-sm font-bold text-gray-900 hover:text-brand transition-colors block truncate">
                      {i.value}
                    </a>
                  ) : (
                    <p className="text-sm font-bold text-gray-900">{i.value}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-0.5">{i.sub}</p>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-4 py-5">
              <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                <IconClock size={20} stroke={1.8} className="text-brand" />
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Business hours</p>
                <p className="text-sm font-bold text-gray-900">Mon – Sat: 9:00 AM – 6:00 PM</p>
                <p className="text-xs text-gray-400 mt-0.5">Sunday closed</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </section>
  );
}
