import { useState, useEffect, ReactNode } from 'react';
import { IconChevronDown, IconChevronRight, IconDeviceFloppy, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import api from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import { inputStyle } from '../components/FormField';

// ─── Types ───────────────────────────────────────────────────────────────────
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
  { name: 'Ahmed Raza', initials: 'AR', role: 'Fleet Manager · Karachi', text: 'TrackVee has completely changed how we manage our 40-vehicle fleet. Real-time tracking and alerts have reduced fuel costs by 20% in just 3 months.', rating: 5, enabled: true },
  { name: 'Sadia Malik', initials: 'SM', role: 'Business Owner · Lahore', text: 'Installation was smooth and the platform is very easy to use. Our delivery team is now more accountable and customers get accurate ETAs.', rating: 5, enabled: true },
  { name: 'Usman Khan', initials: 'UK', role: 'Personal vehicle owner · Lahore', text: 'I use TrackVee for my family cars. The alerts when my car moves are a great security feature. Setup was done at my home in under an hour.', rating: 5, enabled: true },
  { name: 'Tariq Hussain', initials: 'TH', role: 'Operations Head · Islamabad', text: 'We track 80+ vehicles across Punjab. The geofence alerts and reports have helped us cut unauthorized trips significantly.', rating: 5, enabled: true },
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
  description: 'The TrackVee mobile app puts live GPS tracking, alerts, and trip history right on your phone — available on Android and iOS.',
  points: [
    { title: 'Live map', desc: 'See all your vehicles in real time on an interactive map.' },
    { title: 'Instant alerts', desc: 'Get push notifications for movement, ignition, and geofence events.' },
    { title: 'Trip history', desc: 'Replay any trip and review full route history on your phone.' },
    { title: 'Manage anywhere', desc: 'Add vehicles, edit alerts, and share access — all from the app.' },
  ],
  playStoreUrl: 'https://play.google.com/store',
  appStoreUrl: 'https://apps.apple.com',
  imageUrl: '/app-screenshot.webp',
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

// ─── Shared UI helpers ─────────────────────────────────────────────────────────
function Section({ title, open, onToggle, saving, saved, onSave, children }: {
  title: string; open: boolean; onToggle: () => void;
  saving: boolean; saved: boolean; onSave: () => void; children: ReactNode;
}) {
  const { dark } = useTheme();
  const border = dark ? '#2a2a2a' : '#eee';
  return (
    <div style={{ borderBottom: `1px solid ${border}` }}>
      <button
        onClick={onToggle}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'transparent', border: 0, cursor: 'pointer', textAlign: 'left' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {open ? <IconChevronDown size={15} color="#bbb" /> : <IconChevronRight size={15} color="#bbb" />}
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        </div>
        {open && (
          <button
            onClick={e => { e.stopPropagation(); onSave(); }}
            disabled={saving}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', background: saving ? '#fca5a5' : '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: saving ? 'default' : 'pointer' }}
          >
            {saved ? <IconCheck size={13} /> : <IconDeviceFloppy size={13} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          </button>
        )}
      </button>
      {open && <div style={{ padding: '0 20px 20px' }}>{children}</div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const { dark } = useTheme();
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 500, color: dark ? '#555' : '#888', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{ width: 38, height: 20, borderRadius: 10, border: 0, background: value ? '#dc2626' : '#ddd', position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
    >
      <span style={{ position: 'absolute', top: 2, left: value ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left 0.2s' }} />
    </button>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────
export default function WebsiteSettingsPanel() {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const toggle = (k: string) => setOpen(p => ({ ...p, [k]: !p[k] }));

  // ── State per section ──
  const [heroImage, setHeroImage] = useState('/hero-laptop.webp');
  const [partners, setPartners] = useState<PartnerItem[]>(mkPartners());
  const [reviews, setReviews] = useState<ReviewItem[]>(mkReviews());
  const [solutions, setSolutions] = useState<SolutionsSettings>(mkSolutions());
  const [mobileApp, setMobileApp] = useState<MobileAppSettings>(mkMobileApp());
  const [packages, setPackages] = useState<PackageItem[]>(mkPackages());
  const [contact, setContact] = useState<ContactSettings>(mkContact());

  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  // ── Load settings on mount ──
  useEffect(() => {
    api.get<Record<string, unknown>>('/site-settings').then(r => {
      const d = r.data;
      if (d.hero) setHeroImage((d.hero as { imageUrl: string }).imageUrl ?? heroImage);
      if (d.partners) setPartners(d.partners as PartnerItem[]);
      if (d.reviews) setReviews(d.reviews as ReviewItem[]);
      if (d.solutions) setSolutions(d.solutions as SolutionsSettings);
      if (d.mobileApp) setMobileApp(d.mobileApp as MobileAppSettings);
      if (d.packages) setPackages(d.packages as PackageItem[]);
      if (d.contact) setContact(d.contact as ContactSettings);
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
    } catch { /* error silently */ }
    finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const { dark } = useTheme();
  const inp: React.CSSProperties = { ...inputStyle, marginTop: 0 };

  return (
    <div style={{ padding: 0 }}>

      {/* ── 1. Hero Section ── */}
      <Section title="Hero Section" open={!!open.hero} onToggle={() => toggle('hero')}
        saving={!!saving.hero} saved={!!saved.hero} onSave={() => save('hero', { imageUrl: heroImage })}>
        <Field label="Background Image URL">
          <input style={inp} value={heroImage} onChange={e => setHeroImage(e.target.value)} placeholder="/hero-laptop.webp or https://..." />
        </Field>
        {heroImage && (
          <div style={{ marginTop: 8, borderRadius: 8, overflow: 'hidden', maxWidth: 320, border: '1px solid var(--border)' }}>
            {/* eslint-disable-next-line @next/react/no-img-element */}
            <img src={heroImage} alt="preview" style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
        <p style={{ fontSize: 11, color: '#aaa', marginTop: 8 }}>Recommended: 1920×1080px, landscape. Upload to server and use path like /hero-laptop.webp</p>
      </Section>

      {/* ── 2. Our Partners ── */}
      <Section title="Our Partners" open={!!open.partners} onToggle={() => toggle('partners')}
        saving={!!saving.partners} saved={!!saved.partners} onSave={() => save('partners', partners)}>
        {partners.map((p, i) => (
          <div key={i} style={{ background: dark ? '#1a1a1a' : '#fafafa', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Partner {i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#aaa' }}>{p.enabled ? 'Visible' : 'Hidden'}</span>
                <Toggle value={p.enabled} onChange={v => setPartners(prev => prev.map((x, j) => j === i ? { ...x, enabled: v } : x))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Name"><input style={inp} value={p.name} onChange={e => setPartners(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Jazz" /></Field>
              <Field label="Abbr (fallback text)"><input style={inp} value={p.abbr} onChange={e => setPartners(prev => prev.map((x, j) => j === i ? { ...x, abbr: e.target.value } : x))} placeholder="Jazz" /></Field>
            </div>
            <Field label="Logo URL"><input style={inp} value={p.logoUrl} onChange={e => setPartners(prev => prev.map((x, j) => j === i ? { ...x, logoUrl: e.target.value } : x))} placeholder="https://logo.clearbit.com/jazz.com.pk" /></Field>
            {p.logoUrl && <img src={p.logoUrl} alt={p.name} style={{ height: 28, marginTop: 6, objectFit: 'contain', opacity: 0.6 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
          </div>
        ))}
      </Section>

      {/* ── 3. Reviews ── */}
      <Section title="Reviews" open={!!open.reviews} onToggle={() => toggle('reviews')}
        saving={!!saving.reviews} saved={!!saved.reviews} onSave={() => save('reviews', reviews)}>
        {reviews.map((r, i) => (
          <div key={i} style={{ background: dark ? '#1a1a1a' : '#fafafa', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Review {i + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#aaa' }}>{r.enabled ? 'Visible' : 'Hidden'}</span>
                <Toggle value={r.enabled} onChange={v => setReviews(prev => prev.map((x, j) => j === i ? { ...x, enabled: v } : x))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Name"><input style={inp} value={r.name} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Ahmed Raza" /></Field>
              <Field label="Initials"><input style={inp} value={r.initials} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, initials: e.target.value } : x))} placeholder="AR" maxLength={3} /></Field>
            </div>
            <Field label="Role · City"><input style={inp} value={r.role} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, role: e.target.value } : x))} placeholder="Fleet Manager · Karachi" /></Field>
            <Field label="Review text">
              <textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={r.text} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="Write the review here..." />
            </Field>
            <Field label="Rating (1–5)">
              <input style={{ ...inp, width: 60 }} type="number" min={1} max={5} value={r.rating} onChange={e => setReviews(prev => prev.map((x, j) => j === i ? { ...x, rating: Number(e.target.value) } : x))} />
            </Field>
          </div>
        ))}
      </Section>

      {/* ── 4. Our Solution ── */}
      <Section title="Our Solution" open={!!open.solutions} onToggle={() => toggle('solutions')}
        saving={!!saving.solutions} saved={!!saved.solutions} onSave={() => save('solutions', solutions)}>
        <Field label="Section Heading"><input style={inp} value={solutions.heading} onChange={e => setSolutions(p => ({ ...p, heading: e.target.value }))} /></Field>
        <Field label="Section Description"><textarea style={{ ...inp, minHeight: 56, resize: 'vertical' }} value={solutions.description} onChange={e => setSolutions(p => ({ ...p, description: e.target.value }))} /></Field>
        {solutions.cards.map((card, ci) => (
          <div key={ci} style={{ background: dark ? '#1a1a1a' : '#fafafa', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 10 }}>Card {ci + 1}</div>
            <Field label="Heading"><input style={inp} value={card.heading} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, heading: e.target.value } : c) }))} /></Field>
            <Field label="Subtitle"><textarea style={{ ...inp, minHeight: 52, resize: 'vertical' }} value={card.subtitle} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, subtitle: e.target.value } : c) }))} /></Field>
            <label style={{ fontSize: 11, fontWeight: 500, color: dark ? '#555' : '#888', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 6 }}>Points (up to 8 — empty ones hidden)</label>
            {[...Array(8)].map((_, pi) => (
              <input key={pi} style={{ ...inp, marginBottom: 6 }} value={card.points[pi] ?? ''} placeholder={`Point ${pi + 1}`}
                onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => { if (j !== ci) return c; const pts = [...(c.points ?? [])]; pts[pi] = e.target.value; return { ...c, points: pts }; }) }))} />
            ))}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              <Field label="Learn More Label"><input style={inp} value={card.learnMoreLabel} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, learnMoreLabel: e.target.value } : c) }))} /></Field>
              <Field label="Learn More URL"><input style={inp} value={card.learnMoreUrl} onChange={e => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, learnMoreUrl: e.target.value } : c) }))} /></Field>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <Toggle value={card.openExternal} onChange={v => setSolutions(p => ({ ...p, cards: p.cards.map((c, j) => j === ci ? { ...c, openExternal: v } : c) }))} />
              <span style={{ fontSize: 12, color: 'var(--text2)' }}>Open in new tab (external)</span>
            </div>
          </div>
        ))}
      </Section>

      {/* ── 5. Mobile App ── */}
      <Section title="Mobile App Section" open={!!open.mobileApp} onToggle={() => toggle('mobileApp')}
        saving={!!saving.mobileApp} saved={!!saved.mobileApp} onSave={() => save('mobileApp', mobileApp)}>
        <Field label="Heading (use \\n for line break)"><input style={inp} value={mobileApp.heading} onChange={e => setMobileApp(p => ({ ...p, heading: e.target.value }))} /></Field>
        <Field label="Description"><textarea style={{ ...inp, minHeight: 60, resize: 'vertical' }} value={mobileApp.description} onChange={e => setMobileApp(p => ({ ...p, description: e.target.value }))} /></Field>
        <label style={{ fontSize: 11, fontWeight: 500, color: dark ? '#555' : '#888', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 8 }}>App Features (4)</label>
        {mobileApp.points.map((pt, i) => (
          <div key={i} style={{ background: dark ? '#1a1a1a' : '#fafafa', border: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, borderRadius: 8, padding: '10px 12px', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#aaa', marginBottom: 8 }}>Feature {i + 1}</div>
            <Field label="Title"><input style={inp} value={pt.title} onChange={e => setMobileApp(p => ({ ...p, points: p.points.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} /></Field>
            <Field label="Description"><input style={inp} value={pt.desc} onChange={e => setMobileApp(p => ({ ...p, points: p.points.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) }))} /></Field>
          </div>
        ))}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Google Play URL"><input style={inp} value={mobileApp.playStoreUrl} onChange={e => setMobileApp(p => ({ ...p, playStoreUrl: e.target.value }))} /></Field>
          <Field label="App Store URL"><input style={inp} value={mobileApp.appStoreUrl} onChange={e => setMobileApp(p => ({ ...p, appStoreUrl: e.target.value }))} /></Field>
        </div>
        <Field label="Phone Image URL"><input style={inp} value={mobileApp.imageUrl} onChange={e => setMobileApp(p => ({ ...p, imageUrl: e.target.value }))} placeholder="/app-screenshot.webp" /></Field>
      </Section>

      {/* ── 6. Package Plan ── */}
      <Section title="Package Plan" open={!!open.packages} onToggle={() => toggle('packages')}
        saving={!!saving.packages} saved={!!saved.packages} onSave={() => save('packages', packages)}>
        {packages.map((pkg, pi) => (
          <div key={pi} style={{ background: dark ? '#1a1a1a' : '#fafafa', border: `1px solid ${pkg.featured ? '#dc2626' : dark ? '#2a2a2a' : '#eee'}`, borderRadius: 8, padding: '12px 14px', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: pkg.featured ? '#dc2626' : 'var(--text)' }}>Package {pi + 1}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#aaa' }}>Featured</span>
                <Toggle value={pkg.featured} onChange={v => setPackages(prev => prev.map((x, j) => ({ ...x, featured: j === pi ? v : false })))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Package Name"><input style={inp} value={pkg.name} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, name: e.target.value } : x))} /></Field>
              <Field label="CTA Label"><input style={inp} value={pkg.ctaLabel} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, ctaLabel: e.target.value } : x))} /></Field>
            </div>
            <Field label="Description"><textarea style={{ ...inp, minHeight: 52, resize: 'vertical' }} value={pkg.desc} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, desc: e.target.value } : x))} /></Field>
            <Field label="CTA Link (URL or #anchor)"><input style={inp} value={pkg.ctaLink} onChange={e => setPackages(prev => prev.map((x, j) => j === pi ? { ...x, ctaLink: e.target.value } : x))} /></Field>
            <label style={{ fontSize: 11, fontWeight: 500, color: dark ? '#555' : '#888', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 6 }}>Features (up to 8 — empty ones hidden)</label>
            {[...Array(8)].map((_, fi) => (
              <input key={fi} style={{ ...inp, marginBottom: 6 }} value={pkg.features[fi] ?? ''} placeholder={`Feature ${fi + 1}`}
                onChange={e => setPackages(prev => prev.map((x, j) => { if (j !== pi) return x; const fs = [...(x.features ?? [])]; fs[fi] = e.target.value; return { ...x, features: fs }; }))} />
            ))}
          </div>
        ))}
      </Section>

      {/* ── 7. Get in Touch (Contact) ── */}
      <Section title="Get in Touch" open={!!open.contact} onToggle={() => toggle('contact')}
        saving={!!saving.contact} saved={!!saved.contact} onSave={() => save('contact', contact)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="WhatsApp Number"><input style={inp} value={contact.whatsapp} onChange={e => setContact(p => ({ ...p, whatsapp: e.target.value }))} placeholder="+92 300 0000000" /></Field>
          <Field label="Phone Number"><input style={inp} value={contact.phone} onChange={e => setContact(p => ({ ...p, phone: e.target.value }))} placeholder="+92 300 0000000" /></Field>
          <Field label="Sales Email"><input style={inp} value={contact.emailSales} onChange={e => setContact(p => ({ ...p, emailSales: e.target.value }))} placeholder="sales@trackvee.com" /></Field>
          <Field label="Support Email"><input style={inp} value={contact.emailSupport} onChange={e => setContact(p => ({ ...p, emailSupport: e.target.value }))} placeholder="support@trackvee.com" /></Field>
          <Field label="Address"><input style={inp} value={contact.address} onChange={e => setContact(p => ({ ...p, address: e.target.value }))} placeholder="Lahore, Pakistan" /></Field>
          <Field label="Business Hours"><input style={inp} value={contact.hours} onChange={e => setContact(p => ({ ...p, hours: e.target.value }))} placeholder="Mon – Sat: 9:00 AM – 6:00 PM" /></Field>
          <Field label="Hours Sub-text"><input style={inp} value={contact.hoursSub} onChange={e => setContact(p => ({ ...p, hoursSub: e.target.value }))} placeholder="Sunday closed" /></Field>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: dark ? '#1a1a1a' : '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 8, marginTop: 4 }}>
          <IconAlertCircle size={14} color="#16a34a" />
          <span style={{ fontSize: 11, color: '#16a34a' }}>Changes appear on trackvee.com within ~60 seconds after saving.</span>
        </div>
      </Section>

    </div>
  );
}
