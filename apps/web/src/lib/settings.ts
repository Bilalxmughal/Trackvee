export interface PartnerItem {
  name: string;
  logoUrl: string;
  abbr: string;
  enabled: boolean;
}

export interface ReviewItem {
  name: string;
  initials: string;
  role: string;
  text: string;
  rating: number;
  enabled: boolean;
}

export interface SolutionCard {
  heading: string;
  subtitle: string;
  points: string[];
  learnMoreLabel: string;
  learnMoreUrl: string;
  openExternal: boolean;
}

export interface SolutionsSettings {
  heading: string;
  description: string;
  cards: SolutionCard[];
}

export interface MobileFeature {
  title: string;
  desc: string;
}

export interface MobileAppSettings {
  heading: string;
  description: string;
  points: MobileFeature[];
  playStoreUrl: string;
  appStoreUrl: string;
  imageUrl: string;
}

export interface PackageItem {
  name: string;
  desc: string;
  features: string[];
  featured: boolean;
  ctaLabel: string;
  ctaLink: string;
}

export interface ContactSettings {
  whatsapp: string;
  phone: string;
  emailSales: string;
  emailSupport: string;
  address: string;
  hours: string;
  hoursSub: string;
}

export interface SiteSettings {
  hero: { imageUrl: string };
  partners: PartnerItem[];
  reviews: ReviewItem[];
  solutions: SolutionsSettings;
  mobileApp: MobileAppSettings;
  packages: PackageItem[];
  contact: ContactSettings;
}

const API = process.env.API_URL ?? 'https://admin.trackvee.com/api/v1';

export async function fetchSiteSettings(): Promise<Partial<SiteSettings>> {
  try {
    const res = await fetch(`${API}/site-settings`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return {};
    return res.json() as Promise<Partial<SiteSettings>>;
  } catch {
    return {};
  }
}
