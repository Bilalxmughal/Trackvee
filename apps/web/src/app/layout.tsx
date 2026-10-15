import type { Metadata } from 'next';
import './globals.css';
import CookieNotice from '@/components/CookieNotice';
import ScrollAnimations from '@/components/ScrollAnimations';

export const metadata: Metadata = {
  title: 'TrackVee — GPS Vehicle Tracking in Pakistan',
  description: 'Live tracking, trip history and alerts for the vehicles your business or family depends on.',
  keywords: 'GPS tracking Pakistan, vehicle tracking, fleet management, TrackVee',
  openGraph: {
    title: 'TrackVee — GPS Vehicle Tracking in Pakistan',
    description: 'Live tracking, trip history and alerts for the vehicles your business or family depends on.',
    type: 'website',
    siteName: 'TrackVee',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        {children}
        <CookieNotice />
        <ScrollAnimations />
      </body>
    </html>
  );
}
