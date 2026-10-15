import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TrackVee — GPS Vehicle Tracking in Pakistan',
  description: 'Live tracking, trip history and alerts for the vehicles your business or family depends on.',
  keywords: 'GPS tracking Pakistan, vehicle tracking, fleet management, TrackVee',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
