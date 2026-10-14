import { useEffect, useState, useCallback } from 'react';
import { IconPlus, IconTrash, IconCheck, IconDeviceFloppy } from '@tabler/icons-react';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { canPerformAction } from '../config/roles';
import type { UserRole } from '@yotrack/types';
import api from '../api/client';

interface GlobalPricing {
  devicePrice: number;
  installationCharge: number;
  removalCharge: number;
  transferCharge: number;
  reactivationCharge: number;
  monthlyFixedCharge: number;
  taxPercent: number;
  thresholdEnabled: boolean;
  thresholdDays: number;
}

interface ActivityType {
  id: string;
  name: string;
  charge: number;
  isActive: boolean;
  isBuiltIn: boolean;
  sortOrder: number;
}

const DEFAULTS: GlobalPricing = {
  devicePrice: 0, installationCharge: 0, removalCharge: 0,
  transferCharge: 0, reactivationCharge: 0, monthlyFixedCharge: 0,
  taxPercent: 0, thresholdEnabled: true, thresholdDays: 5,
};

export default function PricingPage() {
  const { dark } = useTheme();
  const { user } = useAuth();
  const role = (user?.role ?? 'viewer') as UserRole;
  const canEdit = canPerformAction(role, 'financial-pricing', 'edit');

  const [pricing, setPricing] = useState<GlobalPricing>(DEFAULTS);
  const [activities, setActivities] = useState<ActivityType[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newActivity, setNewActivity] = useState({ name: '', charge: 0 });
  const [addingActivity, setAddingActivity] = useState(false);

  const bg = dark ? '#141414' : '#f5f5f5';
  const card = dark ? '#1e1e1e' : '#fff';
  const border = dark ? '#2a2a2a' : '#e5e5e5';
  const text = dark ? '#e5e5e5' : '#1a1a1a';
  const sub = dark ? '#888' : '#666';
  const inputBg = dark ? '#252525' : '#fafafa';

  const load = useCallback(async () => {
    const [p, a] = await Promise.all([
      api.get('/billing/pricing').then(r => r.data),
      api.get('/billing/pricing/activities').then(r => r.data),
    ]);
    setPricing({ ...DEFAULTS, ...p });
    setActivities(a);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/billing/pricing', pricing);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  const handleAddActivity = async () => {
    if (!newActivity.name.trim()) return;
    await api.post('/billing/pricing/activities', { ...newActivity, sortOrder: activities.length + 1 });
    setNewActivity({ name: '', charge: 0 });
    setAddingActivity(false);
    load();
  };

  const handleActivityChange = async (id: string, field: keyof ActivityType, value: any) => {
    setActivities(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
    await api.patch(`/billing/pricing/activities/${id}`, { [field]: value });
  };

  const handleDeleteActivity = async (id: string) => {
    if (!confirm('Delete this activity type?')) return;
    await api.delete(`/billing/pricing/activities/${id}`);
    load();
  };

  const numField = (label: string, key: keyof GlobalPricing, prefix = 'Rs.') => (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 12, color: sub }}>{prefix}</span>
        <input
          type="number" min={0} step={0.01}
          value={pricing[key] as number}
          disabled={!canEdit}
          onChange={e => setPricing(prev => ({ ...prev, [key]: parseFloat(e.target.value) || 0 }))}
          style={{
            width: 130, padding: '6px 10px', border: `1px solid ${border}`,
            borderRadius: 6, background: canEdit ? inputBg : (dark ? '#1a1a1a' : '#f0f0f0'),
            color: text, fontSize: 13, outline: 'none',
          }}
        />
      </div>
    </div>
  );

  const sectionStyle: React.CSSProperties = {
    background: card, border: `1px solid ${border}`, borderRadius: 10,
    padding: 20, marginBottom: 16,
  };

  const sectionTitle = (t: string) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: sub, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 16 }}>{t}</div>
  );

  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 };
  const row3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 };

  return (
    <div style={{ minHeight: '100vh', background: bg, padding: '24px 28px' }}>
      <PageHeader title="Pricing" subtitle="Global rates — apply to all clients unless overridden">
        {canEdit && (
          <button
            onClick={handleSave} disabled={saving}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
              background: saved ? '#16a34a' : '#dc2626', color: '#fff',
              border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {saved ? <IconCheck size={15} /> : <IconDeviceFloppy size={15} />}
            {saved ? 'Saved' : saving ? 'Saving...' : 'Save Pricing'}
          </button>
        )}
      </PageHeader>

      <div style={{ maxWidth: 680 }}>
        {/* Device & Installation */}
        <div style={sectionStyle}>
          {sectionTitle('Device & Installation')}
          <div style={row2}>
            {numField('Device Price (hardware)', 'devicePrice')}
            {numField('Installation Charge', 'installationCharge')}
          </div>
          <div style={row3}>
            {numField('Removal Charge', 'removalCharge')}
            {numField('Transfer Charge', 'transferCharge')}
            {numField('Reactivation Charge', 'reactivationCharge')}
          </div>
        </div>

        {/* Monthly Charges */}
        <div style={sectionStyle}>
          {sectionTitle('Monthly Charges')}
          <div style={row2}>
            {numField('Monthly Fixed Charge (per device)', 'monthlyFixedCharge')}
            {numField('Tax / GST %', 'taxPercent', '%')}
          </div>
        </div>

        {/* Billing Rules */}
        <div style={sectionStyle}>
          {sectionTitle('Billing Rules')}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 13, color: text, fontWeight: 500 }}>Short-Use Monthly Waiver</div>
              <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
                If device is active for fewer than threshold days, monthly charge is waived
              </div>
            </div>
            <button
              onClick={() => canEdit && setPricing(p => ({ ...p, thresholdEnabled: !p.thresholdEnabled }))}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: canEdit ? 'pointer' : 'default',
                background: pricing.thresholdEnabled ? '#dc2626' : (dark ? '#333' : '#ccc'),
                position: 'relative', transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: pricing.thresholdEnabled ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', background: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
              }} />
            </button>
          </div>
          {pricing.thresholdEnabled && (
            <div>
              <div style={{ fontSize: 12, color: sub, marginBottom: 4 }}>Threshold Days</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="number" min={1} max={31}
                  value={pricing.thresholdDays}
                  disabled={!canEdit}
                  onChange={e => setPricing(p => ({ ...p, thresholdDays: parseInt(e.target.value) || 5 }))}
                  style={{
                    width: 80, padding: '6px 10px', border: `1px solid ${border}`,
                    borderRadius: 6, background: inputBg, color: text, fontSize: 13, outline: 'none',
                  }}
                />
                <span style={{ fontSize: 12, color: sub }}>days — if device active for less than this, monthly charge is waived</span>
              </div>
            </div>
          )}
        </div>

        {/* Activity Charges */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            {sectionTitle('Activity Charges')}
            {canEdit && (
              <button
                onClick={() => setAddingActivity(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px',
                  background: 'transparent', border: `1px solid ${border}`,
                  borderRadius: 6, color: text, fontSize: 12, cursor: 'pointer',
                }}
              >
                <IconPlus size={13} /> Add Activity
              </button>
            )}
          </div>

          {activities.map(act => (
            <div key={act.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10,
              padding: '8px 12px', background: dark ? '#252525' : '#f9f9f9',
              borderRadius: 7, border: `1px solid ${border}`,
            }}>
              <div style={{ flex: 1, fontSize: 13, color: text }}>{act.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 11, color: sub }}>Rs.</span>
                <input
                  type="number" min={0} step={0.01} value={act.charge}
                  disabled={!canEdit}
                  onChange={e => handleActivityChange(act.id, 'charge', parseFloat(e.target.value) || 0)}
                  onBlur={e => handleActivityChange(act.id, 'charge', parseFloat(e.target.value) || 0)}
                  style={{
                    width: 100, padding: '4px 8px', border: `1px solid ${border}`,
                    borderRadius: 5, background: inputBg, color: text, fontSize: 12, outline: 'none',
                  }}
                />
              </div>
              <button
                onClick={() => handleActivityChange(act.id, 'isActive', !act.isActive)}
                disabled={!canEdit}
                style={{
                  padding: '3px 10px', borderRadius: 5, border: 'none', fontSize: 11, cursor: 'pointer',
                  background: act.isActive ? 'rgba(22,163,74,0.12)' : (dark ? '#333' : '#f0f0f0'),
                  color: act.isActive ? '#16a34a' : sub,
                }}
              >
                {act.isActive ? 'Active' : 'Off'}
              </button>
              {!act.isBuiltIn && canEdit && (
                <button
                  onClick={() => handleDeleteActivity(act.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', padding: 2 }}
                >
                  <IconTrash size={14} />
                </button>
              )}
            </div>
          ))}

          {addingActivity && (
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center', marginTop: 10,
              padding: '10px 12px', background: dark ? '#252525' : '#f9f9f9',
              borderRadius: 7, border: `1px dashed ${border}`,
            }}>
              <input
                placeholder="Activity name"
                value={newActivity.name}
                onChange={e => setNewActivity(p => ({ ...p, name: e.target.value }))}
                style={{
                  flex: 1, padding: '5px 10px', border: `1px solid ${border}`,
                  borderRadius: 6, background: inputBg, color: text, fontSize: 13, outline: 'none',
                }}
              />
              <span style={{ fontSize: 11, color: sub }}>Rs.</span>
              <input
                type="number" min={0} step={0.01} placeholder="0"
                value={newActivity.charge}
                onChange={e => setNewActivity(p => ({ ...p, charge: parseFloat(e.target.value) || 0 }))}
                style={{
                  width: 90, padding: '5px 8px', border: `1px solid ${border}`,
                  borderRadius: 6, background: inputBg, color: text, fontSize: 13, outline: 'none',
                }}
              />
              <button onClick={handleAddActivity}
                style={{ padding: '5px 14px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>
                Add
              </button>
              <button onClick={() => setAddingActivity(false)}
                style={{ padding: '5px 10px', background: 'transparent', border: `1px solid ${border}`, borderRadius: 6, fontSize: 12, cursor: 'pointer', color: text }}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Formula Preview */}
        <div style={{ ...sectionStyle, background: dark ? '#1a1a2e' : '#fff8f0', borderColor: dark ? '#2a2a4a' : '#fed7aa' }}>
          {sectionTitle('Bill Formula')}
          <div style={{ fontSize: 13, color: text, fontFamily: 'monospace' }}>
            Device Price + Installation + Activity + Monthly Fixed + Tax = Total
          </div>
          <div style={{ fontSize: 12, color: sub, marginTop: 8, fontFamily: 'monospace' }}>
            {pricing.devicePrice.toLocaleString()} + {pricing.installationCharge.toLocaleString()} + 0 + {pricing.monthlyFixedCharge.toLocaleString()} + {pricing.taxPercent}% ={' '}
            <strong style={{ color: '#dc2626' }}>
              {(pricing.devicePrice + pricing.installationCharge + pricing.monthlyFixedCharge * (1 + pricing.taxPercent / 100)).toLocaleString('en-PK', { maximumFractionDigits: 0 })}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
