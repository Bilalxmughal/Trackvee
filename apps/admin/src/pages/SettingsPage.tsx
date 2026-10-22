import { useEffect, useRef, useState, FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { IconPlus, IconEdit, IconTrash, IconMapPin, IconBellRinging, IconWorld, IconDeviceMobile, IconUpload, IconPhoto, IconCheck, IconX } from '@tabler/icons-react';
import type { UserRole } from '@yotrack/types';
import api from '../api/client';
import { canAccessPage } from '../config/roles';
import { fmtDate } from '../utils/date';
import PageHeader from '../components/PageHeader';
import Spinner from '../components/Spinner';
import SkeletonTable from '../components/SkeletonTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import FormField, { inputStyle, selectStyle, FormActions } from '../components/FormField';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import NotificationSoundsPage from './NotificationSoundsPage';
import WebsiteSettingsPanel from './WebsiteSettingsPanel';

interface City { id: string; displayId: number; name: string; province: string | null; isActive: boolean; createdAt: string; }

type Tab = 'cities' | 'notifications' | 'website' | 'app-launch';

const empty = { name: '', province: '', isActive: true };

export default function SettingsPage() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const location = useLocation();
  const role = (user?.role ?? 'viewer') as UserRole;
  const canViewCities = canAccessPage(role, 'settings');
  const canViewSounds = canAccessPage(role, 'notification-sounds');
  const [activeTab, setActiveTab] = useState<Tab>(() =>
    location.pathname.endsWith('/notifications') || (!canViewCities && canViewSounds) ? 'notifications' : 'cities'
  );

  const [cities, setCities] = useState<City[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<City | null>(null);
  const [form, setForm] = useState<{ name: string; province: string; isActive: boolean }>(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<City | null>(null);
  const [deletingId, setDeletingId] = useState(false);

  const load = () => api.get<City[]>('/cities').then(r => setCities(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => {
    if (!canViewCities) { setLoading(false); return; }
    void api.get<City[]>('/cities').then(r => setCities(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [canViewCities]);

  const openAdd = () => { setEditing(null); setForm(empty); setModal(true); };
  const openEdit = (c: City) => { setEditing(c); setForm({ name: c.name, province: c.province ?? '', isActive: c.isActive }); setModal(true); };
  const closeModal = () => { setModal(false); setEditing(null); };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const payload = { ...form, province: form.province || null };
      if (editing) await api.patch(`/cities/${editing.id}`, payload);
      else await api.post('/cities', payload);
      await load(); closeModal();
    } catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleting) return; setDeletingId(true);
    try {
      await api.delete(`/cities/${deleting.id}`);
      setCities(c => c.filter(x => x.id !== deleting.id)); setDeleting(null);
    } catch {} finally { setDeletingId(false); }
  };

  const TABS = [
    ...(canViewCities ? [{ key: 'cities' as const, label: 'Cities', icon: IconMapPin }] : []),
    ...(canViewSounds ? [{ key: 'notifications' as const, label: 'Alert Notifications', icon: IconBellRinging }] : []),
    ...(canViewCities ? [{ key: 'website' as const, label: 'Website Settings', icon: IconWorld }] : []),
    ...(canViewCities ? [{ key: 'app-launch' as const, label: 'App Launch Screen', icon: IconDeviceMobile }] : []),
  ];

  const activeTabLabel = TABS.find(t => t.key === activeTab)?.label ?? '';

  return (
    <div>
      <PageHeader title="Settings" count={activeTab === 'cities' ? cities.length : undefined} action={
        activeTab === 'cities' ? (
          <button onClick={openAdd} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
            <IconPlus size={13} /> Add City
          </button>
        ) : undefined
      } />

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 20px', fontSize: 12, color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>
        <span style={{ color: 'var(--muted)' }}>Settings</span>
        <span style={{ color: 'var(--muted)', fontSize: 14 }}>›</span>
        <span style={{ color: '#dc2626', fontWeight: 500 }}>{activeTabLabel}</span>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 130px)' }}>
        {/* Left panel */}
        <div style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${dark ? '#2a2a2a' : 'var(--border)'}`, overflowY: 'auto' }}>
          <div style={{ padding: '10px 16px 6px', fontSize: 10, fontWeight: 700, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>
            Configuration
          </div>
          {TABS.map(tab => {
            const on = activeTab === tab.key;
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                role="tab"
                aria-selected={on}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 16px', border: 0, textAlign: 'left', cursor: 'pointer',
                  background: on ? 'rgba(220,38,38,0.06)' : 'transparent',
                  borderLeft: `3px solid ${on ? '#dc2626' : 'transparent'}`,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => { if (!on) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.04)' : 'var(--bg2)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = on ? 'rgba(220,38,38,0.06)' : 'transparent'; }}
              >
                <Icon size={15} color={on ? '#dc2626' : '#bbb'} />
                <div style={{ fontSize: 13, fontWeight: on ? 600 : 400, color: on ? '#dc2626' : 'var(--text)' }}>{tab.label}</div>
              </button>
            );
          })}
        </div>

        {/* Right panel */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {activeTab === 'notifications' && canViewSounds && <NotificationSoundsPage embedded />}
          {activeTab === 'website' && canViewCities && <WebsiteSettingsPanel />}
          {activeTab === 'app-launch' && canViewCities && <AppLaunchPanel dark={dark} />}
          {activeTab === 'cities' && (
            loading ? <SkeletonTable cols={6} /> : (
              <div className="tbl-wrap page-table">
                <table>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['ID', 'City Name', 'Province', 'Status', 'Created', ''].map(h => (
                        <th key={h} style={{ padding: '10px 16px', textAlign: 'left', color: '#aaa', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cities.map(c => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border2)', borderLeft: `3px solid ${c.isActive ? '#22c55e' : '#e5e7eb'}` }}>
                        <td style={{ padding: '11px 16px', color: 'var(--muted)' }}>{c.displayId}</td>
                        <td style={{ padding: '11px 16px', fontWeight: 500 }}>{c.name}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--text2)' }}>{c.province ?? '—'}</td>
                        <td style={{ padding: '11px 16px', color: c.isActive ? '#16a34a' : 'var(--muted)' }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                        <td style={{ padding: '11px 16px', color: 'var(--muted)' }}>{fmtDate(c.createdAt)}</td>
                        <td style={{ padding: '11px 16px' }}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => openEdit(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#555')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconEdit size={14} /></button>
                            <button onClick={() => setDeleting(c)} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#bbb', padding: 5, borderRadius: 6 }}
                              onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}><IconTrash size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!cities.length && <tr><td colSpan={6} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc' }}>No cities added yet</td></tr>}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>
      </div>

      <Modal open={modal} title={editing ? 'Edit City' : 'Add City'} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          <FormField label="City Name *">
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Lahore" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>
          <FormField label="Province">
            <input value={form.province} onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
              placeholder="e.g. Punjab" style={inputStyle}
              onFocus={e => { e.currentTarget.style.borderColor = '#dc2626'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(220,38,38,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.boxShadow = 'none'; }} />
          </FormField>
          <FormField label="Status">
            <select value={String(form.isActive)} onChange={e => setForm(f => ({ ...f, isActive: e.target.value === 'true' }))} style={selectStyle}>
              <option value="true">Active</option><option value="false">Inactive</option>
            </select>
          </FormField>
          <FormActions onClose={closeModal} loading={saving} submitLabel={editing ? 'Update' : 'Create'} />
        </form>
      </Modal>

      <ConfirmDialog open={!!deleting} title="Delete City"
        message={`Delete city "${deleting?.name}"? This cannot be undone.`}
        onConfirm={handleDelete} onClose={() => setDeleting(null)} loading={deletingId} />
    </div>
  );
}

// ── App Launch Screen Panel ────────────────────────────────────────────────────
function AppLaunchPanel({ dark }: { dark: boolean }) {
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
      setImageUrl(res.data.url);
    } catch {} finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/site-settings/app-launch', { imageUrl, duration });
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch {} finally { setSaving(false); }
  };

  const apiBase = (api.defaults.baseURL ?? '').replace(/\/api\/v1$/, '');
  const previewUrl = imageUrl.startsWith('http') ? imageUrl : imageUrl ? `${apiBase}${imageUrl}` : '';

  if (loading) return <div style={{ padding: 32, display: 'flex', justifyContent: 'center' }}><Spinner /></div>;

  return (
    <div style={{ maxWidth: 680, padding: '28px 28px 48px' }}>
      <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>App Launch Screen</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 24 }}>
        This image is shown to users when the mobile app opens. It appears full-screen for the configured duration.
      </div>

      {/* Image upload */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Launch Image</div>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', marginBottom: 24 }}>
        {/* Preview phone */}
        <div style={{
          width: 90, height: 160, borderRadius: 14, border: `2px solid ${dark ? '#333' : '#e5e7eb'}`,
          overflow: 'hidden', background: dark ? '#1a1a1a' : '#f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative',
        }}>
          {previewUrl
            ? <img src={previewUrl} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <IconPhoto size={24} color="#bbb" />
          }
        </div>
        <div style={{ flex: 1 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8, border: `1.5px dashed ${dark ? '#444' : '#d1d5db'}`, background: 'transparent', cursor: 'pointer', fontSize: 12.5, color: 'var(--text)', fontWeight: 500, marginBottom: 10 }}
          >
            <IconUpload size={14} /> {uploading ? 'Uploading…' : 'Upload Image'}
          </button>
          {imageUrl && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 500 }}>Image set</span>
              <button onClick={() => setImageUrl('')} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#bbb', display: 'flex', padding: 2 }}
                onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')} onMouseLeave={e => (e.currentTarget.style.color = '#bbb')}>
                <IconX size={13} />
              </button>
            </div>
          )}
          <div style={{ fontSize: 11, color: '#bbb', lineHeight: 1.6 }}>
            Recommended: <strong>1080 × 1920 px</strong> (portrait, 9:16 ratio)<br />
            Format: JPG or PNG &nbsp;·&nbsp; Max size: 5 MB
          </div>
        </div>
      </div>

      {/* Duration */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Display Duration</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <input
          type="range" min={1} max={10} value={duration}
          onChange={e => setDuration(Number(e.target.value))}
          style={{ flex: 1, accentColor: '#dc2626' }}
        />
        <div style={{
          minWidth: 52, padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${dark ? '#333' : '#e5e7eb'}`,
          fontSize: 14, fontWeight: 700, textAlign: 'center', color: '#dc2626',
        }}>
          {duration}s
        </div>
        <span style={{ fontSize: 12, color: '#bbb', whiteSpace: 'nowrap' }}>({duration} second{duration !== 1 ? 's' : ''})</span>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving || !imageUrl}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 22px', borderRadius: 9, border: 'none',
          background: saved ? '#16a34a' : '#dc2626', color: '#fff',
          fontSize: 13, fontWeight: 600, cursor: saving || !imageUrl ? 'not-allowed' : 'pointer',
          opacity: !imageUrl ? 0.5 : 1, transition: 'background 0.2s',
        }}
      >
        {saved ? <><IconCheck size={14} /> Saved!</> : saving ? 'Saving…' : 'Save Settings'}
      </button>
    </div>
  );
}
