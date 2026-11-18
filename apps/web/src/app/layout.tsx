import type { Metadata } from 'next';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';
import CookieNotice from '@/components/CookieNotice';
import ScrollAnimations from '@/components/ScrollAnimations';

const GA_ID = 'G-XXXXXXXXXX';

export const metadata: Metadata = {
  title: 'TrackVee — GPS Vehicle Tracking in Pakistan',
  description: 'Live tracking, trip history and alerts for the vehicles your business or family depends on.',
  keywords: 'GPS tracking Pakistan, vehicle tracking, fleet management, TrackVee',
  openGraph: {
    title: 'TrackVee — GPS Vehicle Tracking in Pakistan',
    description: 'Live tracking, trip history and alerts for the vehicles your business or family depends on.',
    url: 'https://trackvee.com',
    type: 'website',
    siteName: 'TrackVee',
    images: [{ url: 'https://trackvee.com/og-image.png', width: 1200, height: 630, alt: 'TrackVee GPS Tracking' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TrackVee — GPS Vehicle Tracking in Pakistan',
    description: 'Live tracking, trip history and alerts for the vehicles your business or family depends on.',
    images: ['https://trackvee.com/og-image.png'],
  },
};

const localBusinessSchema = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'TrackVee',
  description: 'GPS vehicle tracking hardware and software for fleets and individuals in Pakistan.',
  url: 'https://trackvee.com',
  telephone: '+92-300-000-0000',
  email: 'sales@trackvee.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Lahore',
    addressRegion: 'Punjab',
    addressCountry: 'PK',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 31.5204,
    longitude: 74.3587,
  },
  areaServed: ['Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Pakistan'],
  serviceType: 'GPS Vehicle Tracking',
  priceRange: '$$',
  openingHoursSpecification: [
    { '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '09:00', closes: '18:00' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body suppressHydrationWarning>
        {children}
        <CookieNotice />
        <ScrollAnimations />
        <Analytics />
        <SpeedInsights />
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga-init" strategy="afterInteractive">{`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}</Script>
      </body>
    </html>
  );
}
