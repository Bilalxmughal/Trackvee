import { MetadataRoute } from 'next';

const BASE = 'https://trackvee.com';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: BASE,                                                              lastModified: new Date(), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/blog`,                                                    lastModified: new Date(), changeFrequency: 'weekly',  priority: 0.8 },
    { url: `${BASE}/contact`,                                                 lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/case-study`,                                              lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog/gps-vehicle-tracking-benefits-pakistan`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog/how-gps-tracking-works`,                            lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog/fleet-management-tips-pakistan`,                    lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/blog/vehicle-tracking-individuals-pakistan`,             lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/privacy`,                                                 lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
    { url: `${BASE}/terms`,                                                   lastModified: new Date(), changeFrequency: 'yearly',  priority: 0.3 },
  ];
}
