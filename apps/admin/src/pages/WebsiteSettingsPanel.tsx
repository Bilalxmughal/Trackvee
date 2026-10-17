import { useState, useEffect, useRef, ReactNode } from 'react';
import {
  IconDeviceFloppy, IconCheck, IconAlertCircle, IconPhoto, IconUsers,
  IconStar, IconBulb, IconDeviceMobile, IconPackage, IconPhone,
  IconUpload, IconLink, IconX,
} from '@tabler/icons-react';
import api from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { inputStyle } from '../components/FormField';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PartnerItem { name: string; logoUrl: string; abbr: string; enabled: boolean; }
interface ReviewItem  { name: string; initials: string; role: string; text: string; rating: number; enabled: boolean; }
interface SolutionCard { heading: string; subtitle: string; points: string[]; learnMoreLabel: string; learnMoreUrl: string; openExternal: boolean; }
interface SolutionsSettings { heading: string; description: string; cards: SolutionCard[]; }
interface MobileFeature  { title: string; desc: string; }
interface MobileAppSettings { heading: string; description: string; points: MobileFeature[]; playStoreUrl: string; appStoreUrl: string; imageUrl: string; }
interface PackageItem { name: string; desc: string; features: string[]; featured: boolean; ctaLabel: string; ctaLink: string; }
interface ContactSettings { whatsapp: string; phone: string; emailSales: string; emailSupport: string; address: string; hours: string; hoursSub: string; }

// ─── Defaults ─────────────────────────────────────────────────────────────────
const mkPartners = (): PartnerItem[] => [
  { name: 'Jazz', logoUrl: 'https://logo.clearbit.com/jazz.com.pk', abbr: 'Jazz', enabled: true },
  { name: 'Zong', logoUrl: 'https://logo.clearbit.com/zong.com.pk', abbr: 'Zong', enabled: true },
  { name: 'Telenor', logoUrl: 'https://logo.clearbit.com/telenor.com.pk', abbr: 'Telenor', enabled: true },
  { name: 'Teltonika', logoUrl: 'https://logo.clearbit.com/teltonika.com', abbr: 'Teltonika', enabled: true },
  { name: 'Queclink', logoUrl: 'https://logo.clearbit.com/queclink.com', abbr: 'Queclink', enabled: true },
  { name: 'Auto Telematics', logoUrl: 'https://logo.clearbit.com/autotelematics.com', abbr: 'ATS-GO', enabled: true },
];
const mkReviews = (): ReviewItem[] => [
  { name: 'Ahmed Raza', initials: 'AR', role: 'Fleet Manager · Karachi', text: 'TrackVee has completely changed how we manage our 40-vehicle fleet.', rating: 5, enabled: true },
  { name: 'Sadia Malik', initials: 'SM', role: 'Business Owner · Lahore', text: 'Installation was smooth and the platform is very easy to use.', rating: 5, enabled: true },
  { name: 'Usman Khan', initials: 'UK', role: 'Personal vehicle owner · Lahore', text: 'I use TrackVee for my family cars. Great security feature.', rating: 5, enabled: true },
  { name: 'Tariq Hussain', initials: 'TH', role: 'Operations Head · Islamabad', text: 'We track 80+ vehicles across Punjab. Geofence alerts are very helpful.', rating: 5, enabled: true },
  { name: '', initials: '', role: '', text: '', rating: 5, enabled: false },
  { name: '', initials: '', role: '', text: '', rating: 5, enabled: false },
];
const mkSolutions = (): SolutionsSettings => ({
  heading: 'One platform for every type of user.',
  description: 'TrackVee is designed for both individuals (B2C) and businesses (B2B), with a reliable platform that adapts to your needs.',
  cards: [
    { heading: 'Individuals (B2C)', subtitle: 'Simple, reliable tracking for personal vehicles.', points: ['Real-time location', 'Trip history', 'Movement alerts', 'Easy mobile and web access', '', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
    { heading: 'Businesses (B2B)', subtitle: 'Powerful tools for fleets, delivery operations and field teams.', points: ['Multi-vehicle tracking', 'Driver behavior monitoring', 'Geofences and alerts', 'Detailed reports', 'Team access and permissions', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
    { heading: 'SaaS Platform', subtitle: 'A complete platform for businesses that need flexibility.', points: ['Web-based platform', 'Fleet and user management', 'Custom reports', 'API access (on request)', 'Scales with your business', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
  ],
});
const mkMobileApp = (): MobileAppSettings => ({
  heading: 'Track your vehicles\nfrom your pocket.',
  description: 'The TrackVee mobile app puts live GPS tracking, alerts, and trip history right on your phone.',
  points: [
    { title: 'Live map', desc: 'See all your vehicles in real time on an interactive map.' },
    { title: 'Instant alerts', desc: 'Get push notifications for movement, ignition, and geofence events.' },
    { title: 'Trip history', desc: 'Replay any trip and review full route history on your phone.' },
    { title: 'Manage anywhere', desc: 'Add vehicles, edit alerts, and share access — all from the app.' },
  ],
  playStoreUrl: 'https://play.google.com/store', appStoreUrl: 'https://apps.apple.com', imageUrl: '/app-screenshot.webp',
});
const mkPackages = (): PackageItem[] => [
  { name: 'Personal', desc: 'A great starting point for individuals and families.', features: ['Live vehicle tracking', 'Trip history and basic reports', 'Key alerts (ignition, movement)', 'Web and mobile access', '', '', '', ''], featured: false, ctaLabel: 'Request pricing', ctaLink: '#contact' },
  { name: 'Fleet', desc: 'More control and insights for growing businesses.', features: ['Everything in Personal', 'Driver behavior monitoring', 'Geofences and custom alerts', 'Detailed trip and stop reports', 'Multi-vehicle management', '', '', ''], featured: true, ctaLabel: 'Request pricing', ctaLink: '#contact' },
  { name: 'SaaS', desc: 'A flexible platform with advanced requirements.', features: ['Everything in Fleet', 'Custom reporting', 'API access (on request)', 'Multi-location management', 'Dedicated account support', '', '', ''], featured: false, ctaLabel: 'Request pricing', ctaLink: '#contact' },
];
const mkContact = (): ContactSettings => ({
  whatsapp: '+92 300 0000000', phone: '+92 300 0000000',
  emailSales: 'sales@trackvee.com', emailSupport: 'support@trackvee.com',
  address: 'Lahore, Pakistan', hours: 'Mon – Sat: 9:00 AM – 6:00 PM', hoursSub: 'Sunday closed',
});

// ─── Tab definitions ──────────────────────────────────────────────────────────
type TabKey = 'hero' | 'partners' | 'reviews' | 'solutions' | 'mobileApp' | 'packages' | 'contact';
const TABS: { key: TabKey; label: string; Icon: React.ElementType }[] = [
  { key: 'hero',      label: 'Hero',         Icon: IconPhoto },
  { key: 'partners',  label: 'Partners',     Icon: IconUsers },
  { key: 'reviews',   label: 'Reviews',      Icon: IconStar },
  { key: 'solutions', label: 'Solution',     Icon: IconBulb },
  { key: 'mobileApp', label: 'Mobile App',   Icon: IconDeviceMobile },
  { key: 'packages',  label: 'Packages',     Icon: IconPackage },
  { key: 'contact',   label: 'Get in Touch', Icon: IconPhone },
];

// ─── Image upload field ────────────────────────────────────────────────────────
function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const { dark } = useTheme();
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ url: string }>('/uploads/image', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onChange(`https://admin.trackvee.com${res.data.url}`);
    } catch { /* silent */ }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const inp: React.CSSProperties = { ...inputStyle, marginTop: 0 };
  const btnBase: React.CSSProperties = { padding: '5px 12px', border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500 };

  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#666' : '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>{label}</label>

      {/* Mode toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button type="button" onClick={() => setMode('url')} style={{ ...btnBase, background: mode === 'url' ? '#dc2626' : 'transparent', color: mode === 'url' ? '#fff' : dark ? '#888' : '#555', borderColor: mode === 'url' ? '#dc2626' : undefined }}>
          <IconLink size={12} /> URL
        </button>
        <button type="button" onClick={() => setMode('upload')} style={{ ...btnBase, background: mode === 'upload' ? '#dc2626' : 'transparent', color: mode === 'upload' ? '#fff' : dark ? '#888' : '#555', borderColor: mode === 'upload' ? '#dc2626' : undefined }}>
          <IconUpload size={12} /> Upload
        </button>
      </div>

      {mode === 'url' ? (
        <input style={inp} value={value} onChange={e => onChange(e.target.value)} placeholder="https://... ya /image.webp" />
      ) : (
        <div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: dark ? '#1a1a1a' : '#f8f8f8', border: `2px dashed ${dark ? '#333' : '#ddd'}`, borderRadius: 8, cursor: uploading ? 'default' : 'pointer', width: '100%', color: dark ? '#888' : '#666', fontSize: 13 }}>
            <IconUpload size={16} />
            {uploading ? 'Uploading…' : 'Click to choose image (max 5MB)'}
          </button>
        </div>
      )}

      {/* Preview */}
      {value && (
        <div style={{ marginTop: 10, position: 'relative', display: 'inline-block' }}>
          <img src={value} alt="preview" style={{ height: 80, maxWidth: 240, objectFit: 'cover', borderRadius: 8, border: `1px solid ${dark ? '#333' : '#eee'}`, display: 'block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <button type="button" onClick={() => onChange('')}
            style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', border: 0, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconX size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Shared helpers ────────────────────────────────────────────────────────────
function Label({ children }: { children: ReactNode }) {
  const { dark } = useTheme();
  return <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#666' : '#888', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>{children}</label>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div style={{ marginBottom: 14 }}><Label>{label}</Label>{children}</div>;
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <button type="button" onClick={() => onChange(!value)}
        style={{ width: 40, height: 22, borderRadius: 11, border: 0, background: value ? '#dc2626' : '#ddd', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
      </button>
      {label && <span style={{ fontSize: 13, color: 'var(--text2)' }}>{label}</span>}
    </div>
  );
}

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 20, marginTop: 12, borderTop: '1px solid var(--border)' }}>
      <button onClick={onSave} disabled={saving}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 22px', background: saved ? '#16a34a' : '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', transition: 'background 0.25s', opacity: saving ? 0.7 : 1 }}>
        {saved ? <IconCheck size={15} /> : <IconDeviceFloppy size={15} />}
        {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
      </button>
    </div>
  );
}

function SectionTitle({ children, sub }: { children: ReactNode; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{children}</h3>
      {sub && <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>{sub}</p>}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function WebsiteSettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('hero');
  const { dark } = useTheme();

  const [heroImage, setHeroImage]   = useState('/hero-laptop.webp');
  const [partners, setPartners]     = useState<PartnerItem[]>(mkPartners());
  const [reviews, setReviews]       = useState<ReviewItem[]>(mkReviews());
  const [solutions, setSolutions]   = useState<SolutionsSettings>(mkSolutions());
  const [mobileApp, setMobileApp]   = useState<MobileAppSettings>(mkMobileApp());
  const [packages, setPackages]     = useState<PackageItem[]>(mkPackages());
  const [contact, setContact]       = useState<ContactSettings>(mkContact());

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved,  setSaved]  = useState<Record<string, boolean>>({});

  useEffect(() => {
    api.get<Record<string, unknown>>('/site-settings').then(r => {
      const d = r.data;
      if (d.hero)      setHeroImage((d.hero as { imageUrl: string }).imageUrl ?? heroImage);
      if (d.partners)  setPartners(d.partners as PartnerItem[]);
      if (d.reviews)   setReviews(d.reviews as ReviewItem[]);
      if (d.solutions) setSolutions(d.solutions as SolutionsSettings);
      if (d.mobileApp) setMobileApp(d.mobileApp as MobileAppSettings);
      if (d.packages)  setPackages(d.packages as PackageItem[]);
      if (d.contact)   setContact(d.contact as ContactSettings);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (key: string, value: unknown) => {
    setSaving(p => ({ ...p, [key]: true }));
    setSaved(p => ({ ...p, [key]: false }));
    try {
      await api.put(`/site-settings/${key}`, value);
      setSaved(p => ({ ...p, [key]: true }));
      setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2500);
    } catch { /* silent */ }
    finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const inp: React.CSSProperties = { ...inputStyle, marginTop: 0 };
  const card = { background: dark ? '#181818' : '#fafafa', border: `1px solid ${dark ? '#262626' : '#eee'}`, borderRadius: 10, padding: '16px' } as React.CSSProperties;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Top Tab Bar ── */}
      <div style={{ display: 'flex', padding: '10px 20px 0', borderBottom: `1px solid ${dark ? '#222' : '#eee'}`, background: dark ? '#0f0f0f' : '#fff', flexShrink: 0, gap: 2, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label, Icon }) => {
          const on = activeTab === key;
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 0, cursor: 'pointer', background: 'transparent', borderBottom: `2px solid ${on ? '#dc2626' : 'transparent'}`, marginBottom: -1, color: on ? '#dc2626' : dark ? '#666' : '#888', fontWeight: on ? 600 : 400, fontSize: 13, transition: 'color 0.15s', whiteSpace: 'nowrap' }}>
              <Icon size={14} />{label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, maxWidth: 800 }}>

        {/* ──────── 1. HERO ──────── */}
        {activeTab === 'hero' && (
          <div>
            <SectionTitle sub="Homepage ka main banner image change karo">Hero Section</SectionTitle>
            <ImageField label="Background Image" value={heroImage} onChange={setHeroImage} />
            <div style={{ padding: '10px 14px', background: dark ? '#1a1a1a' : '#fffbeb', border: `1px solid ${dark ? '#333' : '#fde68a'}`, borderRadius: 8, fontSize: 12, color: dark ? '#a16207' : '#92400e' }}>
              Recommended size: <strong>1920 × 1080px</strong> (landscape). Formats: JPG, PNG, WebP.
            </div>
            <SaveBar saving={!!saving.hero} saved={!!saved.hero} onSave={() => save('hero', { imageUrl: heroImage })} />
          </div>
        )}

        {/* ──────── 2. PARTNERS ──────── */}
        {activeTab === 'partners' && (
          <div>
            <SectionTitle sub="Website pe show hone wale partner logos manage karo">Our Partners</SectionTitle>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {partners.map((p, i) => (
                <div key={i} style={{ ...card, borderLeft: `3px solid ${p.enabled ? '#dc2626' : dark ? '#333' : '#ddd'}` }}>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {p.logoUrl
                        ? <img src={p.logoUrl} alt={p.name} style={{ height: 28, maxWidth: 64, objectFit: 'contain' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                        : <div style={{ width: 40, height: 28, background: dark ? '#222' : '#eee', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#aaa' }}>{p.abbr || '?'}</div>
                      }
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{p.name || `Partner ${i + 1}`}</span>
                    </div>
                    <Toggle value={p.enabled} onChange={v => setPartners(prev => prev.map((x, j) => j === i ? { ...x, enabled: v } : x))} />
                  </div>

                  <Field label="Partner Name">
                    <input style={inp} value={p.name} onChange={e => setPartners(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Jazz" />
                  </Field>
                  <Field label="Short Abbr (logo fallback)">
                    <input style={{ ...inp, width: 80 }} value={p.abbr} onChange={e => setPartners(prev => prev.map((x, j) => j === i ? { ...x, abbr: e.target.value } : x))} placeholder="Jazz" maxLength={8} />
                  </Field>
                  <ImageField label="Logo Image"
                    value={p.logoUrl}
                    onChange={url => setPartners(prev => prev.map((x, j) => j === i ? { ...x, logoUrl: url } : x))} />
                </div>
              ))}
            </div>
            <SaveBar saving={!!saving.partners} saved={!!saved.partners} onSave={() => save('partners', partners)} />
          </div>
        )}

        {/* ──────── 3. REVIEWS ──────── */}
        {activeTab === 'reviews' && (
          <div>
            <SectionTitle sub="Customer reviews manage karo — enable/disable each review">Reviews</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {reviews.map((r, i) => (
                <div key={i} style={{ ...card, borderLeft: `3px solid ${r.enabled ? '#dc2626' : dark ? '#333' : '#ddd'}`, opacity: r.enabled ? 1 : 0.55 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    {/* Avatar */}
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: r.enabled ? '#dc2626' : dark ? '#333' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: r.enabled ? '#fff' : '#aaa', flexShrink: 0 }}>
                      {r.initials || (i + 1)}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                        <Field label="Full Name"><input style={inp} value={r.name} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Ahmed Raza" /></Field>
                        <Field label="Initials (2–3 chars)"><input style={{ ...inp, width: 70 }} value={r.initials} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, initials: e.target.value } : x))} placeholder="AR" maxLength={3} /></Field>
                      </div>
                      <Field label="Role & City"><input style={inp} value={r.role} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="Fleet Manager · Karachi" /></Field>
                      <Field label="Review Text">
                        <textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={r.text} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="Customer ka review yahan likhein…" />
                      </Field>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Field label="Stars (1–5)">
                          <div style={{ display: 'flex', gap: 4 }}>
                            {[1,2,3,4,5].map(s => (
                              <button key={s} type="button" onClick={() => setReviews(prev => prev.map((x, j) => j === i ? { ...x, rating: s } : x))}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: s <= r.rating ? '#f59e0b' : '#ddd', fontSize: 20, padding: 0 }}>★</button>
                            ))}
                          </div>
                        </Field>
                        <Toggle value={r.enabled} onChange={v => setReviews(prev => prev.map((x, j) => j === i ? { ...x, enabled: v } : x))} label={r.enabled ? 'Visible on site' : 'Hidden'} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <SaveBar saving={!!saving.reviews} saved={!!saved.reviews} onSave={() => save('reviews', reviews)} />
          </div>
        )}

        {/* ──────── 4. SOLUTIONS ──────── */}
        {activeTab === 'solutions' && (
          <div>
            <SectionTitle sub="'Our Solution' section ka heading aur 3 cards">Our Solution</SectionTitle>
            <div style={{ ...card, marginBottom: 20 }}>
              <Field label="Section Heading"><input style={inp} value={solutions.heading} onChange={e => setSolutions(p => ({ ...p, heading: e.target.value }))} /></Field>
              <Field label="Section Description">
                <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={solutions.description} onChange={e => setSolutions(p => ({ ...p, description: e.target.value }))} />
              </Field>
            </div>

            <Label>Solution Cards (3)</Label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 8 }}>
              {solutions.cards.map((card2, ci) => (
                <div key={ci} style={{ ...card, border: `1px solid ${dark ? '#333' : '#e5e7eb'}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Card {ci + 1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Card Heading"><input style={inp} value={card2.heading} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, heading: e.target.value } : c) }))} /></Field>
                    <Field label="Subtitle">
                      <input style={inp} value={card2.subtitle} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, subtitle: e.target.value } : c) }))} />
                    </Field>
                  </div>
                  <Label>Points (up to 8 — empty ones won't show)</Label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 6, marginBottom: 12 }}>
                    {[...Array(8)].map((_, pi) => (
                      <input key={pi} style={{ ...inp, fontSize: 12 }} value={card2.points[pi] ?? ''} placeholder={`Point ${pi + 1}`}
                        onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => { if (j !== ci) return c; const pts = [...(c.points ?? [])]; pts[pi] = e.target.value; return { ...c, points: pts }; }) }))} />
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <Field label="Button Label"><input style={inp} value={card2.learnMoreLabel} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, learnMoreLabel: e.target.value } : c) }))} /></Field>
                    <Field label="Button Link"><input style={inp} value={card2.learnMoreUrl} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, learnMoreUrl: e.target.value } : c) }))} placeholder="#contact or https://..." /></Field>
                  </div>
                  <Toggle value={card2.openExternal} onChange={v => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, openExternal: v } : c) }))} label="Open link in new tab" />
                </div>
              ))}
            </div>
            <SaveBar saving={!!saving.solutions} saved={!!saved.solutions} onSave={() => save('solutions', solutions)} />
          </div>
        )}

        {/* ──────── 5. MOBILE APP ──────── */}
        {activeTab === 'mobileApp' && (
          <div>
            <SectionTitle sub="Mobile App section ka content aur app store links">Mobile App</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <div style={card}>
                  <Field label="Section Heading (\\n = new line)">
                    <input style={inp} value={mobileApp.heading} onChange={e => setMobileApp(p => ({ ...p, heading: e.target.value }))} />
                  </Field>
                  <Field label="Description">
                    <textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={mobileApp.description} onChange={e => setMobileApp(p => ({ ...p, description: e.target.value }))} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Google Play URL"><input style={{ ...inp, fontSize: 12 }} value={mobileApp.playStoreUrl} onChange={e => setMobileApp(p => ({ ...p, playStoreUrl: e.target.value }))} placeholder="https://play.google.com/..." /></Field>
                    <Field label="App Store URL"><input style={{ ...inp, fontSize: 12 }} value={mobileApp.appStoreUrl} onChange={e => setMobileApp(p => ({ ...p, appStoreUrl: e.target.value }))} placeholder="https://apps.apple.com/..." /></Field>
                  </div>
                </div>
              </div>
              <div>
                <ImageField label="Phone Screenshot" value={mobileApp.imageUrl} onChange={v => setMobileApp(p => ({ ...p, imageUrl: v }))} />
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <Label>App Features (4 points)</Label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 10 }}>
                {mobileApp.points.map((pt, i) => (
                  <div key={i} style={{ ...card }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Feature {i + 1}</div>
                    <Field label="Title"><input style={inp} value={pt.title} onChange={e => setMobileApp(p => ({ ...p, points: p.points.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} /></Field>
                    <Field label="Description"><input style={inp} value={pt.desc} onChange={e => setMobileApp(p => ({ ...p, points: p.points.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) }))} /></Field>
                  </div>
                ))}
              </div>
            </div>
            <SaveBar saving={!!saving.mobileApp} saved={!!saved.mobileApp} onSave={() => save('mobileApp', mobileApp)} />
          </div>
        )}

        {/* ──────── 6. PACKAGES ──────── */}
        {activeTab === 'packages' && (
          <div>
            <SectionTitle sub="3 pricing packages manage karo — ek ko featured mark kar sakte ho">Package Plans</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {packages.map((pkg, pi) => (
                <div key={pi} style={{ ...card, borderTop: `3px solid ${pkg.featured ? '#dc2626' : dark ? '#333' : '#ddd'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: pkg.featured ? '#dc2626' : 'var(--text)' }}>{pkg.name || `Plan ${pi + 1}`}</span>
                    <Toggle value={pkg.featured} onChange={v => setPackages(prev => prev.map((x, j) => ({ ...x, featured: j === pi ? v : false })))} />
                  </div>
                  {pkg.featured && <div style={{ fontSize: 11, color: '#dc2626', fontWeight: 600, marginBottom: 10, background: '#fee2e2', padding: '3px 8px', borderRadius: 5, display: 'inline-block' }}>★ Featured / Most Popular</div>}
                  <Field label="Plan Name"><input style={inp} value={pkg.name} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, name: e.target.value } : x))} placeholder="Personal" /></Field>
                  <Field label="Description">
                    <textarea style={{ ...inp, minHeight: 52, resize: 'vertical', fontSize: 12 }} value={pkg.desc} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, desc: e.target.value } : x))} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <Field label="Button Label"><input style={{ ...inp, fontSize: 12 }} value={pkg.ctaLabel} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, ctaLabel: e.target.value } : x))} /></Field>
                    <Field label="Button Link"><input style={{ ...inp, fontSize: 12 }} value={pkg.ctaLink} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, ctaLink: e.target.value } : x))} /></Field>
                  </div>
                  <Label>Features (up to 8)</Label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                    {[...Array(8)].map((_, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 10, color: (pkg.features[fi] ?? '').trim() ? '#16a34a' : '#ddd', flexShrink: 0 }}>✓</span>
                        <input style={{ ...inp, fontSize: 12, flex: 1 }} value={pkg.features[fi] ?? ''} placeholder={`Feature ${fi + 1}`}
                          onChange={e => setPackages(prev => prev.map((x, j) => { if (j !== pi) return x; const fs = [...(x.features ?? [])]; fs[fi] = e.target.value; return { ...x, features: fs }; }))} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <SaveBar saving={!!saving.packages} saved={!!saved.packages} onSave={() => save('packages', packages)} />
          </div>
        )}

        {/* ──────── 7. CONTACT ──────── */}
        {activeTab === 'contact' && (
          <div>
            <SectionTitle sub="Website pe dikhne wali contact details">"Get in Touch" Section</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Messaging</div>
                <Field label="WhatsApp Number"><input style={inp} value={contact.whatsapp} onChange={e => setContact(p => ({ ...p, whatsapp: e.target.value }))} placeholder="+92 300 0000000" /></Field>
                <Field label="Phone Number"><input style={inp} value={contact.phone} onChange={e => setContact(p => ({ ...p, phone: e.target.value }))} placeholder="+92 300 0000000" /></Field>
              </div>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Email</div>
                <Field label="Sales Email"><input style={inp} value={contact.emailSales} onChange={e => setContact(p => ({ ...p, emailSales: e.target.value }))} placeholder="sales@trackvee.com" /></Field>
                <Field label="Support Email"><input style={inp} value={contact.emailSupport} onChange={e => setContact(p => ({ ...p, emailSupport: e.target.value }))} placeholder="support@trackvee.com" /></Field>
              </div>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Location</div>
                <Field label="Office Address"><input style={inp} value={contact.address} onChange={e => setContact(p => ({ ...p, address: e.target.value }))} placeholder="Lahore, Pakistan" /></Field>
              </div>
              <div style={card}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>Business Hours</div>
                <Field label="Hours"><input style={inp} value={contact.hours} onChange={e => setContact(p => ({ ...p, hours: e.target.value }))} placeholder="Mon – Sat: 9:00 AM – 6:00 PM" /></Field>
                <Field label="Hours Note"><input style={inp} value={contact.hoursSub} onChange={e => setContact(p => ({ ...p, hoursSub: e.target.value }))} placeholder="Sunday closed" /></Field>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: dark ? '#0f1f0f' : '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 8, marginTop: 16 }}>
              <IconAlertCircle size={15} color="#16a34a" />
              <span style={{ fontSize: 12, color: '#16a34a' }}>Changes appear on trackvee.com within ~60 seconds after saving.</span>
            </div>
            <SaveBar saving={!!saving.contact} saved={!!saved.contact} onSave={() => save('contact', contact)} />
          </div>
        )}

      </div>
    </div>
  );
}

