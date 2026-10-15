'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function CookieNotice() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem('tv_cookie_consent')) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem('tv_cookie_consent', 'accepted'); } catch {}
    setVisible(false);
  };

  const decline = () => {
    try { localStorage.setItem('tv_cookie_consent', 'declined'); } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white border-t border-gray-100 shadow-lg px-6 lg:px-16 py-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 max-w-screen-xl mx-auto">
        <p className="text-sm text-gray-600 flex-1 leading-relaxed">
          We use cookies to improve your experience and show relevant ads.{' '}
          <Link href="/privacy" className="text-brand font-semibold hover:underline">Learn more</Link>
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={decline}
            className="text-xs font-semibold text-gray-400 hover:text-gray-700 px-4 py-2 transition-colors"
          >
            Decline
          </button>
          <button
            onClick={accept}
            className="text-xs font-semibold bg-brand text-white px-5 py-2 rounded-lg hover:bg-brand-dark transition-colors"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}
