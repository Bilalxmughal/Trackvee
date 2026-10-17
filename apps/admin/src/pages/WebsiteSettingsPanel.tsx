import { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import {
  IconDeviceFloppy, IconCheck, IconAlertCircle, IconPhoto, IconUsers,
  IconStar, IconBulb, IconDeviceMobile, IconPackage, IconPhone,
  IconUpload, IconLink, IconX, IconPlus, IconTrash, IconEdit,
  IconEye, IconToggleLeft, IconToggleRight,
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
const mkReviews = (): ReviewItem[] => [
  { name: 'Ahmed Raza',    initials: 'AR', role: 'Fleet Manager · Karachi',        text: 'TrackVee has completely changed how we manage our 40-vehicle fleet. Real-time tracking and alerts have reduced fuel costs by 20%.', rating: 5, enabled: true },
  { name: 'Sadia Malik',   initials: 'SM', role: 'Business Owner · Lahore',        text: 'Installation was smooth and the platform is very easy to use. Our delivery team is now more accountable.', rating: 5, enabled: true },
  { name: 'Usman Khan',    initials: 'UK', role: 'Personal vehicle owner · Lahore', text: 'I use TrackVee for my family cars. The alerts when my car moves are a great security feature.', rating: 5, enabled: true },
  { name: 'Tariq Hussain', initials: 'TH', role: 'Operations Head · Islamabad',    text: 'We track 80+ vehicles across Punjab. Geofence alerts and reports have helped us cut unauthorized trips.', rating: 5, enabled: true },
  { name: '', initials: '', role: '', text: '', rating: 5, enabled: false },
  { name: '', initials: '', role: '', text: '', rating: 5, enabled: false },
];
const mkSolutions = (): SolutionsSettings => ({
  heading: 'One platform for every type of user.',
  description: 'TrackVee is designed for both individuals (B2C) and businesses (B2B), with a reliable platform that adapts to your needs.',
  cards: [
    { heading: 'Individuals (B2C)', subtitle: 'Simple, reliable tracking for personal vehicles.', points: ['Real-time location', 'Trip history', 'Movement alerts', 'Easy mobile and web access', '', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
    { heading: 'Businesses (B2B)', subtitle: 'Powerful tools for fleets, delivery operations and field teams.', points: ['Multi-vehicle tracking', 'Driver behavior monitoring', 'Geofences and alerts', 'Detailed reports', 'Team access and permissions', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
    { heading: 'SaaS Platform',    subtitle: 'A complete platform for businesses that need flexibility.', points: ['Web-based platform', 'Fleet and user management', 'Custom reports', 'API access (on request)', 'Scales with your business', '', '', ''], learnMoreLabel: 'Learn more', learnMoreUrl: '#contact', openExternal: false },
  ],
});
const mkMobileApp = (): MobileAppSettings => ({
  heading: 'Track your vehicles\nfrom your pocket.',
  description: 'The TrackVee mobile app puts live GPS tracking, alerts, and trip history right on your phone.',
  points: [
    { title: 'Live map',       desc: 'See all your vehicles in real time on an interactive map.' },
    { title: 'Instant alerts', desc: 'Get push notifications for movement, ignition, and geofence events.' },
    { title: 'Trip history',   desc: 'Replay any trip and review full route history on your phone.' },
    { title: 'Manage anywhere',desc: 'Add vehicles, edit alerts, and share access — all from the app.' },
  ],
  playStoreUrl: 'https://play.google.com/store', appStoreUrl: 'https://apps.apple.com', imageUrl: '/app-screenshot.webp',
});
const mkPackages = (): PackageItem[] => [
  { name: 'Personal', desc: 'A great starting point for individuals and families.', features: ['Live vehicle tracking', 'Trip history and basic reports', 'Key alerts (ignition, movement)', 'Web and mobile access', '', '', '', ''], featured: false, ctaLabel: 'Request pricing', ctaLink: '#contact' },
  { name: 'Fleet',    desc: 'More control and insights for growing businesses.',   features: ['Everything in Personal', 'Driver behavior monitoring', 'Geofences and custom alerts', 'Detailed trip and stop reports', 'Multi-vehicle management', '', '', ''], featured: true, ctaLabel: 'Request pricing', ctaLink: '#contact' },
  { name: 'SaaS',    desc: 'A flexible platform with advanced requirements.',      features: ['Everything in Fleet', 'Custom reporting', 'API access (on request)', 'Multi-location management', 'Dedicated account support', '', '', ''], featured: false, ctaLabel: 'Request pricing', ctaLink: '#contact' },
];
const mkContact = (): ContactSettings => ({
  whatsapp: '+92 300 0000000', phone: '+92 300 0000000',
  emailSales: 'sales@trackvee.com', emailSupport: 'support@trackvee.com',
  address: 'Lahore, Pakistan', hours: 'Mon – Sat: 9:00 AM – 6:00 PM', hoursSub: 'Sunday closed',
});
const emptyPartner = (): PartnerItem => ({ name: '', logoUrl: '', abbr: '', enabled: true });

// ─── Tabs ─────────────────────────────────────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════
//  TOAST
// ═══════════════════════════════════════════════════════════
interface ToastMsg { id: number; text: string; type: 'success' | 'error'; }
let _toastId = 0;
function useToast() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const show = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    const id = ++_toastId;
    setToasts(p => [...p, { id, text, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, show };
}
function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', background: t.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff', borderRadius: 10, fontSize: 13, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,.25)', animation: 'fadeUp .25s ease' }}>
          {t.type === 'success' ? <IconCheck size={15} /> : <IconAlertCircle size={15} />}
          {t.text}
        </div>
      ))}
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  IMAGE FIELD (URL + Upload)
// ═══════════════════════════════════════════════════════════
function ImageField({ label, value, onChange }: { label: string; value: string; onChange: (url: string) => void }) {
  const { dark } = useTheme();
  const [mode, setMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const res = await api.post<{ url: string }>('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(`https://admin.trackvee.com${res.data.url}`);
    } catch { /* silent */ } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };
  const inp: React.CSSProperties = { ...inputStyle, marginTop: 0 };
  const btnBase = (active: boolean): React.CSSProperties => ({ padding: '4px 11px', border: `1px solid ${active ? '#dc2626' : dark ? '#333' : '#ddd'}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontWeight: 500, background: active ? '#dc2626' : 'transparent', color: active ? '#fff' : dark ? '#888' : '#555' });
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#666' : '#888', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 7 }}>{label}</label>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        <button type="button" onClick={() => setMode('url')} style={btnBase(mode === 'url')}><IconLink size={11} /> URL</button>
        <button type="button" onClick={() => setMode('upload')} style={btnBase(mode === 'upload')}><IconUpload size={11} /> Upload</button>
      </div>
      {mode === 'url'
        ? <input style={inp} value={value} onChange={e => onChange(e.target.value)} placeholder="https://... ya /image.webp" />
        : <div><input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: dark ? '#1a1a1a' : '#f8f8f8', border: `2px dashed ${dark ? '#333' : '#ddd'}`, borderRadius: 8, cursor: uploading ? 'default' : 'pointer', width: '100%', color: dark ? '#888' : '#666', fontSize: 13 }}>
              <IconUpload size={15} />{uploading ? 'Uploading…' : 'Click to choose image (max 5 MB)'}
            </button></div>
      }
      {value && (
        <div style={{ marginTop: 8, position: 'relative', display: 'inline-block' }}>
          <img src={value} alt="preview" style={{ height: 72, maxWidth: 220, objectFit: 'cover', borderRadius: 7, border: `1px solid ${dark ? '#333' : '#eee'}`, display: 'block' }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          <button type="button" onClick={() => onChange('')} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#dc2626', border: 0, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconX size={10} /></button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SMALL HELPERS
// ═══════════════════════════════════════════════════════════
function Field({ label, children }: { label: string; children: ReactNode }) {
  const { dark } = useTheme();
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#666' : '#888', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, border: 0, background: value ? '#dc2626' : '#ccc', position: 'relative', cursor: 'pointer', transition: 'background .2s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 3, left: value ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)' }} />
    </button>
  );
}
function SaveBtn({ saving, saved, onClick }: { saving: boolean; saved: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 20px', background: saved ? '#16a34a' : '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: saving ? 'default' : 'pointer', transition: 'background .25s', opacity: saving ? .7 : 1 }}>
      {saved ? <IconCheck size={14} /> : <IconDeviceFloppy size={14} />}
      {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
    </button>
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

// ═══════════════════════════════════════════════════════════
//  PARTNER MODAL (add / edit / view)
// ═══════════════════════════════════════════════════════════
interface PartnerModalProps {
  mode: 'add' | 'edit' | 'view';
  data: PartnerItem;
  onClose: () => void;
  onSave: (p: PartnerItem) => void;
}
function PartnerModal({ mode: initMode, data, onClose, onSave }: PartnerModalProps) {
  const { dark } = useTheme();
  const [mode, setMode] = useState(initMode);
  const [form, setForm] = useState<PartnerItem>({ ...data });

  const inp: React.CSSProperties = { ...inputStyle, marginTop: 0 };
  const isView = mode === 'view';

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 480, background: dark ? '#1a1a1a' : '#fff', borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,.35)', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxWidth: 'calc(100vw - 32px)' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}` }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {mode === 'add' ? 'Add Partner' : mode === 'edit' ? 'Edit Partner' : 'Partner Details'}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {mode === 'view' && (
              <button onClick={() => setMode('edit')} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                <IconEdit size={13} /> Edit
              </button>
            )}
            <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', padding: 4 }}><IconX size={16} /></button>
          </div>
        </div>
        {/* Body */}
        <div style={{ padding: 20, overflowY: 'auto' }}>
          {isView ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                {form.logoUrl
                  ? <img src={form.logoUrl} alt={form.name} style={{ height: 56, maxWidth: 120, objectFit: 'contain', borderRadius: 8, border: `1px solid ${dark ? '#333' : '#eee'}`, padding: 8 }} />
                  : <div style={{ width: 80, height: 56, background: dark ? '#222' : '#eee', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#aaa', fontWeight: 700 }}>{form.abbr || '?'}</div>
                }
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{form.name}</div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>Abbr: <strong>{form.abbr}</strong></div>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#aaa', wordBreak: 'break-all', marginBottom: 10 }}><strong>Logo URL:</strong> {form.logoUrl || '—'}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>Status:</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: form.enabled ? '#16a34a' : '#aaa' }}>{form.enabled ? 'Visible on site' : 'Hidden'}</span>
              </div>
            </div>
          ) : (
            <div>
              <Field label="Partner Name"><input style={inp} value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Jazz" /></Field>
              <Field label="Short Abbr (logo fallback text)"><input style={{ ...inp, width: 100 }} value={form.abbr} onChange={e => setForm(p => ({ ...p, abbr: e.target.value }))} placeholder="Jazz" maxLength={8} /></Field>
              <ImageField label="Logo Image" value={form.logoUrl} onChange={url => setForm(p => ({ ...p, logoUrl: url }))} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                <Toggle value={form.enabled} onChange={v => setForm(p => ({ ...p, enabled: v }))} />
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{form.enabled ? 'Visible on site' : 'Hidden from site'}</span>
              </div>
            </div>
          )}
        </div>
        {/* Footer */}
        {!isView && (
          <div style={{ padding: '12px 20px', borderTop: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '7px 16px', background: 'transparent', border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 8, color: 'var(--text2)', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
            <button onClick={() => onSave(form)} style={{ padding: '7px 20px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              {mode === 'add' ? 'Add Partner' : 'Save Changes'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function WebsiteSettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('hero');
  const { dark } = useTheme();
  const { toasts, show: toast } = useToast();

  // ── State ──
  const [heroImage,  setHeroImage]  = useState('/hero-laptop.webp');
  const [partners,   setPartners]   = useState<PartnerItem[]>([]);
  const [reviews,    setReviews]    = useState<ReviewItem[]>(mkReviews());
  const [solutions,  setSolutions]  = useState<SolutionsSettings>(mkSolutions());
  const [mobileApp,  setMobileApp]  = useState<MobileAppSettings>(mkMobileApp());
  const [packages,   setPackages]   = useState<PackageItem[]>(mkPackages());
  const [contact,    setContact]    = useState<ContactSettings>(mkContact());

  const [saving,  setSaving]  = useState<Record<string, boolean>>({});
  const [saved,   setSaved]   = useState<Record<string, boolean>>({});

  // Partners modal
  const [partnerModal, setPartnerModal] = useState<{ mode: 'add'|'edit'|'view'; idx: number } | null>(null);

  // Inline-edit indices
  const [editingReview,   setEditingReview]   = useState<number | null>(null);
  const [editingSolution, setEditingSolution] = useState<number | null>(null);
  const [editingMobile,   setEditingMobile]   = useState(false);
  const [editingPkg,      setEditingPkg]      = useState<number | null>(null);
  const [editingContact,  setEditingContact]  = useState(false);

  // Drafts for inline edits
  const [draftReviews,    setDraftReviews]    = useState<ReviewItem[]>([]);
  const [draftSolutions,  setDraftSolutions]  = useState<SolutionsSettings | null>(null);
  const [draftMobile,     setDraftMobile]     = useState<MobileAppSettings | null>(null);
  const [draftPackages,   setDraftPackages]   = useState<PackageItem[]>([]);
  const [draftContact,    setDraftContact]    = useState<ContactSettings | null>(null);

  // ── Load ──
  useEffect(() => {
    api.get<Record<string, unknown>>('/site-settings').then(r => {
      const d = r.data;
      if (d.hero)      setHeroImage((d.hero as { imageUrl: string }).imageUrl);
      if (d.partners)  setPartners(d.partners as PartnerItem[]);
      if (d.reviews)   setReviews(d.reviews as ReviewItem[]);
      if (d.solutions) setSolutions(d.solutions as SolutionsSettings);
      if (d.mobileApp) setMobileApp(d.mobileApp as MobileAppSettings);
      if (d.packages)  setPackages(d.packages as PackageItem[]);
      if (d.contact)   setContact(d.contact as ContactSettings);
    }).catch(() => {});
  }, []);

  const saveKey = async (key: string, value: unknown, label = 'Saved!') => {
    setSaving(p => ({ ...p, [key]: true }));
    try {
      await api.put(`/site-settings/${key}`, value);
      setSaved(p => ({ ...p, [key]: true }));
      toast(label);
      setTimeout(() => setSaved(p => ({ ...p, [key]: false })), 2500);
    } catch { toast('Save failed', 'error'); }
    finally { setSaving(p => ({ ...p, [key]: false })); }
  };

  const inp: React.CSSProperties = { ...inputStyle, marginTop: 0 };
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`, borderRadius: 10, padding: 16, ...extra });

  // ── PARTNER HANDLERS ──
  const openPartnerModal = (mode: 'add'|'edit'|'view', idx: number) => setPartnerModal({ mode, idx });
  const closePartnerModal = () => setPartnerModal(null);
  const handlePartnerSave = (p: PartnerItem) => {
    let next: PartnerItem[];
    if (partnerModal!.idx === -1) { next = [...partners, p]; toast('Partner added!'); }
    else { next = partners.map((x, i) => i === partnerModal!.idx ? p : x); toast('Partner updated!'); }
    setPartners(next);
    saveKey('partners', next, 'Partners saved!').catch(() => {});
    closePartnerModal();
  };
  const deletePartner = (idx: number) => {
    const next = partners.filter((_, i) => i !== idx);
    setPartners(next);
    saveKey('partners', next, 'Partner deleted!');
  };
  const togglePartner = (idx: number) => {
    const next = partners.map((x, i) => i === idx ? { ...x, enabled: !x.enabled } : x);
    setPartners(next);
    saveKey('partners', next, 'Partner updated!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ToastContainer toasts={toasts} />

      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', padding: '10px 20px 0', borderBottom: `1px solid ${dark ? '#222' : '#eee'}`, background: dark ? '#0f0f0f' : '#fff', flexShrink: 0, gap: 2, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label, Icon }) => {
          const on = activeTab === key;
          return (
            <button key={key} onClick={() => setActiveTab(key)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 0, cursor: 'pointer', background: 'transparent', borderBottom: `2px solid ${on ? '#dc2626' : 'transparent'}`, marginBottom: -1, color: on ? '#dc2626' : dark ? '#666' : '#888', fontWeight: on ? 600 : 400, fontSize: 13, transition: 'color .15s', whiteSpace: 'nowrap' }}>
              <Icon size={14} />{label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>

        {/* ────── HERO ────── */}
        {activeTab === 'hero' && (
          <div style={{ maxWidth: 600 }}>
            <SectionTitle sub="Homepage ka main banner image">Hero Section</SectionTitle>
            <ImageField label="Background Image" value={heroImage} onChange={setHeroImage} />
            <div style={{ padding: '10px 14px', background: dark ? '#1a1a1a' : '#fffbeb', border: `1px solid ${dark ? '#333' : '#fde68a'}`, borderRadius: 8, fontSize: 12, color: dark ? '#a16207' : '#92400e', marginBottom: 20 }}>
              Recommended: <strong>1920 × 1080px</strong> landscape. JPG, PNG, or WebP.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <SaveBtn saving={!!saving.hero} saved={!!saved.hero} onClick={() => saveKey('hero', { imageUrl: heroImage }, 'Hero image saved!')} />
            </div>
          </div>
        )}

        {/* ────── PARTNERS ────── */}
        {activeTab === 'partners' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <SectionTitle sub="Website pe dikhne wale partner logos">Our Partners</SectionTitle>
              <button onClick={() => openPartnerModal('add', -1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                <IconPlus size={14} /> Add Partner
              </button>
            </div>

            {partners.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#aaa', fontSize: 14, border: `2px dashed ${dark ? '#333' : '#eee'}`, borderRadius: 10 }}>
                No partners added yet. Click "Add Partner" to get started.
              </div>
            ) : (
              <div style={{ ...card(), overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${dark ? '#262626' : '#f0f0f0'}` }}>
                      {['ID', 'Name', 'Abbr', 'Logo URL', 'Image', 'Status', 'Actions'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#aaa', textTransform: 'uppercase', letterSpacing: .5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partners.map((p, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${dark ? '#1e1e1e' : '#f7f7f7'}` }}>
                        <td style={{ padding: '12px 14px', color: '#aaa', fontSize: 12, fontWeight: 600 }}>#{i + 1}</td>
                        <td style={{ padding: '12px 14px', fontWeight: 600, fontSize: 13, color: 'var(--text)' }}>{p.name || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--muted)' }}>{p.abbr || '—'}</td>
                        <td style={{ padding: '12px 14px', fontSize: 11, color: '#888', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.logoUrl || '—'}</td>
                        <td style={{ padding: '12px 14px' }}>
                          {p.logoUrl
                            ? <img src={p.logoUrl} alt={p.name} style={{ height: 28, maxWidth: 60, objectFit: 'contain', opacity: .8 }} onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                            : <span style={{ fontSize: 11, color: '#aaa' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: p.enabled ? '#16a34a' : '#aaa', background: p.enabled ? (dark ? '#0f2f0f' : '#f0fdf4') : (dark ? '#1a1a1a' : '#f5f5f5'), padding: '3px 9px', borderRadius: 6 }}>
                            {p.enabled ? 'Visible' : 'Hidden'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <button onClick={() => openPartnerModal('view', i)} title="View" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: 6, borderRadius: 6, display: 'flex' }} onMouseEnter={e => (e.currentTarget.style.color = '#3b82f6')} onMouseLeave={e => (e.currentTarget.style.color = '#888')}><IconEye size={15} /></button>
                            <button onClick={() => openPartnerModal('edit', i)} title="Edit" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: 6, borderRadius: 6, display: 'flex' }} onMouseEnter={e => (e.currentTarget.style.color = '#f59e0b')} onMouseLeave={e => (e.currentTarget.style.color = '#888')}><IconEdit size={15} /></button>
                            <button onClick={() => deletePartner(i)} title="Delete" style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: 6, borderRadius: 6, display: 'flex' }} onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#888')}><IconTrash size={15} /></button>
                            <button onClick={() => togglePartner(i)} title={p.enabled ? 'Disable' : 'Enable'} style={{ border: 'none', background: 'none', cursor: 'pointer', color: p.enabled ? '#dc2626' : '#aaa', padding: 6, borderRadius: 6, display: 'flex' }}>
                              {p.enabled ? <IconToggleRight size={18} /> : <IconToggleLeft size={18} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {partnerModal && (
              <PartnerModal
                mode={partnerModal.mode}
                data={partnerModal.idx === -1 ? emptyPartner() : { ...partners[partnerModal.idx] }}
                onClose={closePartnerModal}
                onSave={handlePartnerSave}
              />
            )}
          </div>
        )}

        {/* ────── REVIEWS ────── */}
        {activeTab === 'reviews' && (
          <div>
            <SectionTitle sub="Customer reviews — 2 per row, edit inline">Reviews</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {reviews.map((r, i) => {
                const isEditing = editingReview === i;
                const draft = isEditing ? draftReviews[i] : r;
                return (
                  <div key={i} style={{ ...card({ borderLeft: `3px solid ${r.enabled ? '#dc2626' : dark ? '#333' : '#ddd'}`, opacity: r.enabled ? 1 : .6 }) }}>
                    {!isEditing ? (
                      /* View mode */
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 10 }}>
                          <div style={{ width: 38, height: 38, borderRadius: '50%', background: r.enabled ? '#dc2626' : dark ? '#333' : '#ddd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: r.enabled ? '#fff' : '#aaa', flexShrink: 0 }}>{r.initials || (i+1)}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{r.name || <span style={{ color: '#aaa' }}>Empty slot</span>}</div>
                            <div style={{ fontSize: 11, color: '#aaa', marginTop: 1 }}>{r.role || '—'}</div>
                          </div>
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button onClick={() => { setDraftReviews([...reviews]); setEditingReview(i); }} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: dark ? '#222' : '#f5f5f5', border: `1px solid ${dark ? '#333' : '#eee'}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text2)' }}>
                              <IconEdit size={11} /> Edit
                            </button>
                          </div>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', margin: '0 0 10px', lineHeight: 1.5, minHeight: 36 }}>{r.text || '—'}</p>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ color: '#f59e0b', fontSize: 14 }}>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                          <Toggle value={r.enabled} onChange={v => { const next = reviews.map((x, j) => j === i ? { ...x, enabled: v } : x); setReviews(next); saveKey('reviews', next, 'Review updated!'); }} />
                        </div>
                      </div>
                    ) : (
                      /* Edit mode */
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: .5 }}>Editing Review {i+1}</span>
                          <button onClick={() => setEditingReview(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', display: 'flex', padding: 3 }}><IconX size={14} /></button>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: 8 }}>
                          <Field label="Full Name"><input style={inp} value={draft.name} onChange={e => { const d = [...draftReviews]; d[i] = { ...d[i], name: e.target.value }; setDraftReviews(d); }} placeholder="Ahmed Raza" /></Field>
                          <Field label="Initials"><input style={inp} value={draft.initials} onChange={e => { const d = [...draftReviews]; d[i] = { ...d[i], initials: e.target.value }; setDraftReviews(d); }} placeholder="AR" maxLength={3} /></Field>
                        </div>
                        <Field label="Role & City"><input style={inp} value={draft.role} onChange={e => { const d = [...draftReviews]; d[i] = { ...d[i], role: e.target.value }; setDraftReviews(d); }} placeholder="Fleet Manager · Karachi" /></Field>
                        <Field label="Review Text"><textarea style={{ ...inp, minHeight: 64, resize: 'vertical' }} value={draft.text} onChange={e => { const d = [...draftReviews]; d[i] = { ...d[i], text: e.target.value }; setDraftReviews(d); }} /></Field>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1,2,3,4,5].map(s => (
                              <button key={s} type="button" onClick={() => { const d = [...draftReviews]; d[i] = { ...d[i], rating: s }; setDraftReviews(d); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: s <= draft.rating ? '#f59e0b' : '#ddd', fontSize: 20, padding: 0, lineHeight: 1 }}>★</button>
                            ))}
                          </div>
                          <button onClick={() => { const next = draftReviews; setReviews(next); setEditingReview(null); saveKey('reviews', next, `Review ${i+1} saved!`); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <IconDeviceFloppy size={13} /> Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ────── SOLUTIONS ────── */}
        {activeTab === 'solutions' && (
          <div>
            <SectionTitle sub="Section heading + 3 solution cards">Our Solution</SectionTitle>
            {/* Heading card — full width */}
            <div style={{ ...card({ marginBottom: 20 }) }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Section Heading</span>
              </div>
              <Field label="Heading"><input style={inp} value={solutions.heading} onChange={e => setSolutions(p => ({ ...p, heading: e.target.value }))} /></Field>
              <Field label="Description"><textarea style={{ ...inp, minHeight: 52, resize: 'vertical', marginBottom: 0 }} value={solutions.description} onChange={e => setSolutions(p => ({ ...p, description: e.target.value }))} /></Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
                <SaveBtn saving={!!saving.solutions_heading} saved={!!saved.solutions_heading} onClick={() => saveKey('solutions', solutions, 'Solutions saved!')} />
              </div>
            </div>

            {/* 3 cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {solutions.cards.map((c2, ci) => {
                const isEditing = editingSolution === ci;
                const draft = isEditing ? draftSolutions! : solutions;
                const draftCard = draft.cards[ci];
                return (
                  <div key={ci} style={{ ...card({ borderTop: `3px solid #dc2626` }) }}>
                    {!isEditing ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{c2.heading}</div>
                            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>{c2.subtitle}</div>
                          </div>
                          <button onClick={() => { setDraftSolutions({ ...solutions, cards: solutions.cards.map(x => ({ ...x, points: [...x.points] })) }); setEditingSolution(ci); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: dark ? '#222' : '#f5f5f5', border: `1px solid ${dark ? '#333' : '#eee'}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text2)', flexShrink: 0, marginLeft: 8 }}>
                            <IconEdit size={11} /> Edit
                          </button>
                        </div>
                        <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(c2.points ?? []).filter(p => p.trim()).map(pt => (
                            <li key={pt} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                              <span style={{ color: '#dc2626', fontSize: 14, lineHeight: 1 }}>✓</span>{pt}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: .5 }}>Editing Card {ci+1}</span>
                          <button onClick={() => setEditingSolution(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', display: 'flex', padding: 3 }}><IconX size={14} /></button>
                        </div>
                        <Field label="Heading"><input style={inp} value={draftCard.heading} onChange={e => { const cards = draft.cards.map((x, j) => j === ci ? { ...x, heading: e.target.value } : x); setDraftSolutions({ ...draft, cards }); }} /></Field>
                        <Field label="Subtitle"><textarea style={{ ...inp, minHeight: 52, resize: 'vertical' }} value={draftCard.subtitle} onChange={e => { const cards = draft.cards.map((x, j) => j === ci ? { ...x, subtitle: e.target.value } : x); setDraftSolutions({ ...draft, cards }); }} /></Field>
                        <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#666' : '#888', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Points (up to 8)</label>
                        {[...Array(8)].map((_, pi) => (
                          <input key={pi} style={{ ...inp, marginBottom: 5, fontSize: 12 }} value={draftCard.points[pi] ?? ''} placeholder={`Point ${pi+1}`}
                            onChange={e => { const pts = [...draftCard.points]; pts[pi] = e.target.value; const cards = draft.cards.map((x, j) => j === ci ? { ...x, points: pts } : x); setDraftSolutions({ ...draft, cards }); }} />
                        ))}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
                          <Field label="Button Label"><input style={inp} value={draftCard.learnMoreLabel} onChange={e => { const cards = draft.cards.map((x, j) => j === ci ? { ...x, learnMoreLabel: e.target.value } : x); setDraftSolutions({ ...draft, cards }); }} /></Field>
                          <Field label="Button Link"><input style={inp} value={draftCard.learnMoreUrl} onChange={e => { const cards = draft.cards.map((x, j) => j === ci ? { ...x, learnMoreUrl: e.target.value } : x); setDraftSolutions({ ...draft, cards }); }} /></Field>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                          <button onClick={() => { setSolutions(draft); setEditingSolution(null); saveKey('solutions', draft, `Card ${ci+1} saved!`); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <IconDeviceFloppy size={13} /> Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ────── MOBILE APP ────── */}
        {activeTab === 'mobileApp' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <SectionTitle sub="Mobile App section ka poora content">Mobile App</SectionTitle>
              {!editingMobile
                ? <button onClick={() => { setDraftMobile({ ...mobileApp, points: mobileApp.points.map(x => ({ ...x })) }); setEditingMobile(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: dark ? '#222' : '#f0f0f0', border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>
                    <IconEdit size={14} /> Edit Section
                  </button>
                : <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingMobile(false)} style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>Cancel</button>
                    <button onClick={() => { setMobileApp(draftMobile!); setEditingMobile(false); saveKey('mobileApp', draftMobile!, 'Mobile App saved!'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 18px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <IconDeviceFloppy size={14} /> Save Changes
                    </button>
                  </div>
              }
            </div>

            {!editingMobile ? (
              /* View mode */
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px', gap: 16, marginBottom: 20 }}>
                  <div style={card()}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 6, lineHeight: 1.4 }}>{mobileApp.heading.replace(/\\n/g, '\n').split('\n').map((l, i) => <span key={i}>{l}<br/></span>)}</div>
                    <p style={{ fontSize: 13, color: 'var(--muted)', margin: '0 0 12px' }}>{mobileApp.description}</p>
                    <div style={{ fontSize: 12, color: '#aaa' }}>
                      <div>Google Play: <a href={mobileApp.playStoreUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{mobileApp.playStoreUrl}</a></div>
                      <div style={{ marginTop: 2 }}>App Store: <a href={mobileApp.appStoreUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>{mobileApp.appStoreUrl}</a></div>
                    </div>
                  </div>
                  <div style={card()}>
                    {mobileApp.imageUrl
                      ? <img src={mobileApp.imageUrl} alt="app" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6 }} />
                      : <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontSize: 12 }}>No image</div>
                    }
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {mobileApp.points.map((pt, i) => (
                    <div key={i} style={card({ display: 'flex', gap: 12 })}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 15 }}>
                        {['🗺️','🔔','🕐','📱'][i]}
                      </div>
                      <div><div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 3 }}>{pt.title}</div><div style={{ fontSize: 12, color: 'var(--muted)' }}>{pt.desc}</div></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              /* Edit mode */
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div style={card()}>
                    <Field label="Heading (\\n = line break)"><input style={inp} value={draftMobile!.heading} onChange={e => setDraftMobile(p => ({ ...p!, heading: e.target.value }))} /></Field>
                    <Field label="Description"><textarea style={{ ...inp, minHeight: 72, resize: 'vertical' }} value={draftMobile!.description} onChange={e => setDraftMobile(p => ({ ...p!, description: e.target.value }))} /></Field>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                      <Field label="Google Play URL"><input style={{ ...inp, fontSize: 12 }} value={draftMobile!.playStoreUrl} onChange={e => setDraftMobile(p => ({ ...p!, playStoreUrl: e.target.value }))} /></Field>
                      <Field label="App Store URL"><input style={{ ...inp, fontSize: 12 }} value={draftMobile!.appStoreUrl} onChange={e => setDraftMobile(p => ({ ...p!, appStoreUrl: e.target.value }))} /></Field>
                    </div>
                  </div>
                  <div style={card()}>
                    <ImageField label="Phone Screenshot" value={draftMobile!.imageUrl} onChange={v => setDraftMobile(p => ({ ...p!, imageUrl: v }))} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  {draftMobile!.points.map((pt, i) => (
                    <div key={i} style={card()}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 10 }}>Feature {i+1}</div>
                      <Field label="Title"><input style={inp} value={pt.title} onChange={e => setDraftMobile(p => ({ ...p!, points: p!.points.map((x, j) => j === i ? { ...x, title: e.target.value } : x) }))} /></Field>
                      <Field label="Description"><input style={inp} value={pt.desc} onChange={e => setDraftMobile(p => ({ ...p!, points: p!.points.map((x, j) => j === i ? { ...x, desc: e.target.value } : x) }))} /></Field>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────── PACKAGES ────── */}
        {activeTab === 'packages' && (
          <div>
            <SectionTitle sub="3 pricing plans — featured toggle, edit inline">Package Plans</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {packages.map((pkg, pi) => {
                const isEditing = editingPkg === pi;
                const draft = isEditing ? draftPackages[pi] : pkg;
                return (
                  <div key={pi} style={{ ...card({ borderTop: `3px solid ${pkg.featured ? '#dc2626' : dark ? '#333' : '#e5e7eb'}` }) }}>
                    {!isEditing ? (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontSize: 15, fontWeight: 800, color: pkg.featured ? '#dc2626' : 'var(--text)' }}>{pkg.name}</div>
                            {pkg.featured && <span style={{ fontSize: 10, fontWeight: 700, color: '#dc2626', background: '#fee2e2', padding: '2px 7px', borderRadius: 5, display: 'inline-block', marginTop: 3 }}>★ FEATURED</span>}
                          </div>
                          <button onClick={() => { const d = packages.map(x => ({ ...x, features: [...x.features] })); setDraftPackages(d); setEditingPkg(pi); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: dark ? '#222' : '#f5f5f5', border: `1px solid ${dark ? '#333' : '#eee'}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text2)' }}>
                            <IconEdit size={11} /> Edit
                          </button>
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>{pkg.desc}</p>
                        <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
                          {(pkg.features ?? []).filter(f => f.trim()).map(f => (
                            <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--muted)' }}>
                              <span style={{ color: '#dc2626', fontWeight: 700 }}>✓</span>{f}
                            </li>
                          ))}
                        </ul>
                        <div style={{ fontSize: 12, color: '#aaa' }}>CTA: <strong style={{ color: 'var(--text2)' }}>{pkg.ctaLabel}</strong> → {pkg.ctaLink}</div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: .5 }}>Editing Package {pi+1}</span>
                          <button onClick={() => setEditingPkg(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#aaa', display: 'flex', padding: 3 }}><IconX size={14} /></button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                          <Toggle value={draft.featured} onChange={v => { const d = [...draftPackages]; d[pi] = { ...d[pi], featured: v }; if (v) d.forEach((x, j) => { if (j !== pi) d[j] = { ...d[j], featured: false }; }); setDraftPackages(d); }} />
                          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Featured / Most Popular</span>
                        </div>
                        <Field label="Plan Name"><input style={inp} value={draft.name} onChange={e => { const d = [...draftPackages]; d[pi] = { ...d[pi], name: e.target.value }; setDraftPackages(d); }} /></Field>
                        <Field label="Description"><textarea style={{ ...inp, minHeight: 52, resize: 'vertical', fontSize: 12 }} value={draft.desc} onChange={e => { const d = [...draftPackages]; d[pi] = { ...d[pi], desc: e.target.value }; setDraftPackages(d); }} /></Field>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                          <Field label="Button Label"><input style={{ ...inp, fontSize: 12 }} value={draft.ctaLabel} onChange={e => { const d = [...draftPackages]; d[pi] = { ...d[pi], ctaLabel: e.target.value }; setDraftPackages(d); }} /></Field>
                          <Field label="Button Link"><input style={{ ...inp, fontSize: 12 }} value={draft.ctaLink} onChange={e => { const d = [...draftPackages]; d[pi] = { ...d[pi], ctaLink: e.target.value }; setDraftPackages(d); }} /></Field>
                        </div>
                        <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#666' : '#888', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 5 }}>Features (up to 8)</label>
                        {[...Array(8)].map((_, fi) => (
                          <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{ color: (draft.features[fi] ?? '').trim() ? '#16a34a' : '#ddd', fontSize: 13, flexShrink: 0 }}>✓</span>
                            <input style={{ ...inp, fontSize: 12, flex: 1 }} value={draft.features[fi] ?? ''} placeholder={`Feature ${fi+1}`}
                              onChange={e => { const d = [...draftPackages]; const fs = [...d[pi].features]; fs[fi] = e.target.value; d[pi] = { ...d[pi], features: fs }; setDraftPackages(d); }} />
                          </div>
                        ))}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                          <button onClick={() => { setPackages(draftPackages); setEditingPkg(null); saveKey('packages', draftPackages, `${draftPackages[pi].name || 'Package'} saved!`); }}
                            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            <IconDeviceFloppy size={13} /> Save
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ────── CONTACT ────── */}
        {activeTab === 'contact' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <SectionTitle sub="Website pe dikhne wali contact details">"Get in Touch" Section</SectionTitle>
              {!editingContact
                ? <button onClick={() => { setDraftContact({ ...contact }); setEditingContact(true); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: dark ? '#222' : '#f0f0f0', border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', color: 'var(--text)' }}>
                    <IconEdit size={14} /> Edit
                  </button>
                : <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setEditingContact(false)} style={{ padding: '7px 14px', background: 'transparent', border: `1px solid ${dark ? '#333' : '#ddd'}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', color: 'var(--text2)' }}>Cancel</button>
                    <button onClick={() => { setContact(draftContact!); setEditingContact(false); saveKey('contact', draftContact!, 'Contact info saved!'); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 18px', background: '#dc2626', color: '#fff', border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      <IconDeviceFloppy size={14} /> Save Changes
                    </button>
                  </div>
              }
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
              {/* WhatsApp */}
              <div style={card({ borderTop: `3px solid #25d366` })}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#25d366', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>WhatsApp</div>
                {editingContact
                  ? <Field label="Number"><input style={inp} value={draftContact!.whatsapp} onChange={e => setDraftContact(p => ({ ...p!, whatsapp: e.target.value }))} placeholder="+92 300 0000000" /></Field>
                  : <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{contact.whatsapp}</div>
                }
              </div>
              {/* Phone */}
              <div style={card({ borderTop: `3px solid #3b82f6` })}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>Phone</div>
                {editingContact
                  ? <Field label="Number"><input style={inp} value={draftContact!.phone} onChange={e => setDraftContact(p => ({ ...p!, phone: e.target.value }))} placeholder="+92 300 0000000" /></Field>
                  : <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{contact.phone}</div>
                }
              </div>
              {/* Email */}
              <div style={card({ borderTop: `3px solid #f59e0b` })}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>Email</div>
                {editingContact ? (
                  <div>
                    <Field label="Sales"><input style={{ ...inp, fontSize: 12 }} value={draftContact!.emailSales} onChange={e => setDraftContact(p => ({ ...p!, emailSales: e.target.value }))} /></Field>
                    <Field label="Support"><input style={{ ...inp, fontSize: 12 }} value={draftContact!.emailSupport} onChange={e => setDraftContact(p => ({ ...p!, emailSupport: e.target.value }))} /></Field>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{contact.emailSales}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{contact.emailSupport}</div>
                  </div>
                )}
              </div>
              {/* Hours + Address */}
              <div style={card({ borderTop: `3px solid #8b5cf6` })}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#8b5cf6', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 12 }}>Hours & Address</div>
                {editingContact ? (
                  <div>
                    <Field label="Hours"><input style={{ ...inp, fontSize: 12 }} value={draftContact!.hours} onChange={e => setDraftContact(p => ({ ...p!, hours: e.target.value }))} /></Field>
                    <Field label="Hours Note"><input style={{ ...inp, fontSize: 12 }} value={draftContact!.hoursSub} onChange={e => setDraftContact(p => ({ ...p!, hoursSub: e.target.value }))} /></Field>
                    <Field label="Address"><input style={{ ...inp, fontSize: 12 }} value={draftContact!.address} onChange={e => setDraftContact(p => ({ ...p!, address: e.target.value }))} /></Field>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>{contact.hours}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>{contact.hoursSub}</div>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{contact.address}</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: dark ? '#0f1f0f' : '#f0fdf4', border: '1px solid #dcfce7', borderRadius: 8, marginTop: 16 }}>
              <IconAlertCircle size={14} color="#16a34a" />
              <span style={{ fontSize: 12, color: '#16a34a' }}>Changes appear on trackvee.com within ~60 seconds after saving.</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
