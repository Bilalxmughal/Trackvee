import { IconBrandWhatsapp } from '@tabler/icons-react';

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/923000000000?text=Hi%2C%20I%27m%20interested%20in%20TrackVee%20GPS%20tracking."
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-[#25D366] flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
    >
      <IconBrandWhatsapp size={28} stroke={1.8} className="text-white" />
    </a>
  );
}
