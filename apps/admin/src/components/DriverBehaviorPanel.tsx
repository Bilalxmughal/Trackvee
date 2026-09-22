import { useEffect, useState } from 'react';
import { IconActivity, IconTrash, IconX } from '@tabler/icons-react';
import api from '../api/client';
import Spinner from './Spinner';

interface Settings {
  overspeedThreshold: number;
  harshBrakeDeceleration: number;
  rapidAccelThreshold: number;
  sharpTurnAngle: number;
  sharpTurnMinSpeed: number;
  deductionHarshBrake: number;
  deductionRapidAccel: number;
  deductionSharpTurn: number;
  deductionOverspeed: number;
}

interface Props {
  dark: boolean;
  onClose: () => void;
  orgId?: string;
}

const FIELDS: { key: keyof Settings; label: string; unit: string }[] = [
  { key: 'overspeedThreshold',     label: 'Overspeed Threshold',      unit: 'km/h' },
  { key: 'harshBrakeDeceleration', label: 'Harsh Brake Deceleration', unit: 'km/h/s' },
  { key: 'rapidAccelThreshold',    label: 'Rapid Acceleration',       unit: 'km/h/s' },
  { key: 'sharpTurnAngle',         label: 'Sharp Turn Angle',         unit: 'deg' },
  { key: 'sharpTurnMinSpeed',      label: 'Sharp Turn Min Speed',     unit: 'km/h' },
];
const DEDUCT_FIELDS: { key: keyof Settings; label: string }[] = [
  { key: 'deductionHarshBrake', label: 'Harsh Brake' },
  { key: 'deductionRapidAccel', label: 'Rapid Accel' },
  { key: 'deductionSharpTurn',  label: 'Sharp Turn' },
  { key: 'deductionOverspeed',  label: 'Overspeed' },
];

export default function DriverBehaviorPanel({ dark, onClose, orgId }: Props) {
  const [form, setForm] = useState<Settings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const bd = dark ? '#1e1e1e' : '#fff';
  const border = dark ? '#2d2d2d' : '#f0f0f0';
  const text = dark ? '#e5e7eb' : '#111';
  const muted = dark ? '#9ca3af' : '#6b7280';
  const inputBorder = dark ? '#3d3d3d' : '#e5e7eb';
  const inputBg = dark ? '#2a2a2a' : '#f9fafb';
  const inputColor = dark ? '#e5e7eb' : '#111';

  const qs = orgId ? `?orgId=${orgId}` : '';

  useEffect(() => {
    setForm(null);
    setLoadError(false);
    setSaved(false);
    api.get<Settings>(`/driver-behavior/settings${qs}`)
      .then(r => { if (r.data) setForm(r.data); else setLoadError(true); })
      .catch(() => setLoadError(true));
  }, [qs]);

  const update = (k: keyof Settings, v: string) => {
    setForm(f => f ? { ...f, [k]: parseFloat(v) || 0 } : f);
    setSaved(false);
  };

  const save = async () => {
    if (!form) return;
    setSaving(true);
    try { await api.put(`/driver-behavior/settings${qs}`, form); setSaved(true); } finally { setSaving(false); }
  };

  const inp: React.CSSProperties = {
    height: 28, padding: '0 8px', border: `1px solid ${inputBorder}`,
    borderRadius: 3, fontSize: 12, color: inputColor, background: inputBg,
    outline: 'none', width: 76,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bd }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 14px 10px', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconActivity size={16} color="#dc2626" strokeWidth={1.5}/>
          <span style={{ fontWeight: 700, fontSize: 14, color: text }}>Driver Behavior</span>
        </div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: muted, padding: 4, borderRadius: 4, display: 'flex' }}>
          <IconX size={16}/>
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
        {loadError ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: '#dc2626', fontSize: 13 }}>
            Failed to load settings.
          </div>
        ) : !form ? (
          <Spinner style={{ height: 120 }}/>
        ) : (
          <>
            <div style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Detection Thresholds
            </div>
            {FIELDS.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: muted }}>{f.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}/>
                  <span style={{ fontSize: 11, color: muted, width: 44 }}>{f.unit}</span>
                </div>
              </div>
            ))}

            <div style={{ fontSize: 11, fontWeight: 600, color: muted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 20 }}>
              Score Deductions
            </div>
            {DEDUCT_FIELDS.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: muted }}>{f.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}/>
                  <span style={{ fontSize: 11, color: muted, width: 44 }}>pts</span>
                </div>
              </div>
            ))}

            <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={save}
                disabled={saving}
                style={{ height: 32, padding: '0 16px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Saving...' : saved ? 'Saved' : 'Save Settings'}
              </button>
              {saved && (
                <span style={{ fontSize: 12, color: '#16a34a', fontWeight: 500 }}>Changes saved</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
