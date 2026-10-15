'use client';
import { useState } from 'react';
import { IconBrandWhatsapp, IconX } from '@tabler/icons-react';

export default function WhatsAppButton() {
  const [dismissed, setDismissed] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3">

      {/* Floating help bubble */}
      {!dismissed && (
        <div className="flex items-center gap-2 bg-white rounded-2xl shadow-lg px-4 py-3 border border-gray-100 animate-fade-in">
          <div>
            <p className="text-xs font-bold text-gray-900 leading-tight">Need help?</p>
            <p className="text-xs text-gray-400 leading-tight">Chat with us on WhatsApp</p>
          </div>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="ml-1 text-gray-300 hover:text-gray-500 transition-colors shrink-0"
          >
            <IconX size={14} stroke={2} />
          </button>
        </div>
      )}

      {/* WhatsApp button */}
      <a
        href="https://wa.me/923000000000?text=Hi%2C%20I%27m%20interested%20in%20TrackVee%20GPS%20tracking."
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-110 transition-transform shrink-0"
      >
        <IconBrandWhatsapp size={28} stroke={1.8} className="text-white" />
      </a>

    </div>
  );
}
