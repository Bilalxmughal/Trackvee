import { useState, useEffect, useRef } from 'react';
import { IconDeviceFloppy, IconCheck, IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import api from '../api/client';
import { useTheme } from '../contexts/ThemeContext';
import Spinner from '../components/Spinner';

// ─── Types ────────────────────────────────────────────────────────────────────
type TabKey = 'launch';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'launch', label: 'Launch Screen' },
];

// ─── SaveBtn ──────────────────────────────────────────────────────────────────
function SaveBtn({ saving, saved, disabled, onClick }: { saving: boolean; saved: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={saving || disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '8px 20px', background: saved ? '#16a34a' : '#dc2626', color: '#fff',
        border: 0, borderRadius: 8, fontSize: 13, fontWeight: 600,
        cursor: saving || disabled ? 'not-allowed' : 'pointer',
        transition: 'background .25s', opacity: disabled ? .5 : 1,
      }}
    >
      {saved ? <IconCheck size={14} /> : <IconDeviceFloppy size={14} />}
      {saving ? 'Saving…' : saved ? 'Saved!' : 'Save Changes'}
    </button>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { dark } = useTheme();
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: dark ? '#666' : '#888', textTransform: 'uppercase', letterSpacing: .5, display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

// ─── Hint ─────────────────────────────────────────────────────────────────────
function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: '6px 0 0', fontSize: 11.5, color: 'var(--muted)', lineHeight: 1.6 }}>{children}</p>
  );
}

// ─── Launch Screen Tab ────────────────────────────────────────────────────────
function LaunchScreenTab() {
  const { dark } = useTheme();
  const [imageUrl, setImageUrl] = useState('');
  const [duration, setDuration] = useState(3);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<{ imageUrl?: string; duration?: number }>('/site-settings/app-launch')
      .then(r => {
        if (r.data?.imageUrl) setImageUrl(r.data.imageUrl);
        if (r.data?.duration) setDuration(r.data.duration);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post<{ url: string }>('/uploads/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setImageUrl(`${window.location.origin}${res.data.url}`);
    } catch { /* silent */ } finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/site-settings/app-launch', { imageUrl, duration });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch { /* silent */ } finally { setSaving(false); }
  };

  const previewUrl = imageUrl;

  if (loading) return <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  const inp: React.CSSProperties = { width: '100%', padding: '8px 11px', borderRadius: 7, border: `1.5px solid ${dark ? '#2a2a2a' : '#e8e8e8'}`, fontSize: 13, background: dark ? '#0f0f0f' : '#fff', color: 'var(--text)', outline: 'none', boxSizing: 'border-box' };
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({ background: dark ? '#161616' : '#fff', border: `1px solid ${dark ? '#262626' : '#e5e7eb'}`, borderRadius: 10, padding: 20, ...extra });

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Launch Screen</h3>
        <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--muted)' }}>
          Shown full-screen when the mobile app opens, for the configured duration.
        </p>
      </div>

      {/* Image Section */}
      <div style={card({ marginBottom: 16 })}>
        <Field label="Launch Image">
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            {/* Phone preview */}
            <div style={{
              width: 90, height: 160, borderRadius: 14, border: `2px solid ${dark ? '#333' : '#e5e7eb'}`,
              overflow: 'hidden', background: dark ? '#1a1a1a' : '#f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              {previewUrl
                ? <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <IconPhoto size={26} color="#bbb" />
              }
            </div>

            <div style={{ flex: 1 }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: `1.5px dashed ${dark ? '#444' : '#d1d5db'}`, background: 'transparent', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: 13, color: 'var(--text)', fontWeight: 500, marginBottom: 10 }}
              >
                <IconUpload size={14} />{uploading ? 'Uploading…' : 'Upload Image'}
              </button>

              {imageUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>✓ Image set</span>
                  <button onClick={() => setImageUrl('')} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', padding: 2 }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>
                    <IconX size={13} />
                  </button>
                </div>
              )}

              <div style={{ fontSize: 11, color: '#bbb', lineHeight: 1.7 }}>
                Recommended: <strong>1080 × 1920 px</strong> (portrait, 9:16)<br />
                Format: JPG or PNG &nbsp;·&nbsp; Max: 5 MB
              </div>
            </div>
          </div>
        </Field>
      </div>

      {/* Duration Section */}
      <div style={card({ marginBottom: 20 })}>
        <Field label="Display Duration">
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="range" min={1} max={10} value={duration}
              onChange={e => setDuration(Number(e.target.value))}
              style={{ flex: 1, accentColor: '#dc2626' }}
            />
            <div style={{ minWidth: 52, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${dark ? '#333' : '#e5e7eb'}`, fontSize: 15, fontWeight: 700, textAlign: 'center', color: '#dc2626' }}>
              {duration}s
            </div>
          </div>
          <Hint>Displayed for {duration} second{duration !== 1 ? 's' : ''}. Users can dismiss it early with the Skip button.</Hint>
        </Field>
      </div>

      {/* URL override (optional) */}
      <div style={card({ marginBottom: 20 })}>
        <Field label="Or enter image URL directly">
          <input
            style={inp}
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://... ya /uploads/filename.jpg"
          />
        </Field>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Hint>Launch screen is skipped if no image is configured.</Hint>
        <SaveBtn saving={saving} saved={saved} disabled={!imageUrl} onClick={handleSave} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════
export default function AppSettingsPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>('launch');
  const { dark } = useTheme();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ── Tab Bar ── */}
      <div style={{ display: 'flex', padding: '10px 20px 0', borderBottom: `1px solid ${dark ? '#222' : '#eee'}`, background: dark ? '#0f0f0f' : '#fff', flexShrink: 0, gap: 2, flexWrap: 'wrap' }}>
        {TABS.map(({ key, label }) => {
          const on = activeTab === key;
          return (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 14px', border: 0, cursor: 'pointer', background: 'transparent',
                borderBottom: `2px solid ${on ? '#dc2626' : 'transparent'}`,
                marginBottom: -1, color: on ? '#dc2626' : dark ? '#666' : '#888',
                fontWeight: on ? 600 : 400, fontSize: 13, transition: 'color .15s', whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {activeTab === 'launch' && <LaunchScreenTab />}
      </div>
    </div>
  );
}
