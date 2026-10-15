'use client';
import { useState, useEffect } from 'react';
import { IconArrowUp } from '@tabler/icons-react';

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className="fixed bottom-6 left-6 z-50 w-10 h-10 rounded-full bg-white border border-gray-100 shadow-md flex items-center justify-center text-gray-400 hover:text-brand hover:border-brand transition-colors"
    >
      <IconArrowUp size={18} stroke={2} />
    </button>
  );
}
