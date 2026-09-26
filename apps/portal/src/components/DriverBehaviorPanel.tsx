import { useState, useEffect } from 'react';
import { usePortalPanel } from '../contexts/PortalPanelContext';
import api from '../api/client';

interface BehaviorSettings {
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

const DEFAULT: BehaviorSettings = {
  overspeedThreshold: 100,
  harshBrakeDeceleration: 0.4,
  rapidAccelThreshold: 0.3,
  sharpTurnAngle: 45,
  sharpTurnMinSpeed: 30,
  deductionHarshBrake: 5,
  deductionRapidAccel: 5,
  deductionSharpTurn: 3,
  deductionOverspeed: 2,
};

const inp: React.CSSProperties = { padding: '6px 9px', borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', color: '#111', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };
const LBL: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 4 };
const SECT: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: '#dc2626', textTransform: 'uppercase', letterSpacing: 0.6, padding: '10px 12px 4px', borderBottom: '1px solid #f5f5f5' };

export default function DriverBehaviorPanel() {
  const { closePanel } = usePortalPanel();
  const [settings, setSettings] = useState<BehaviorSettings>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.get<BehaviorSettings>('/driver-behavior/settings')
      .then(r => setSettings(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const field = (label: string, key: keyof BehaviorSettings, unit?: string) => (
    <div>
      <label style={LBL}>{label}{unit ? ` (${unit})` : ''}</label>
      <input type="number" value={settings[key]} onChange={e => setSettings(s => ({ ...s, [key]: +e.target.value }))} style={inp}
        onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
        onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
    </div>
  );

  const save = async () => {
    setSaving(true); setSaved(false);
    try {
      await api.put('/driver-behavior/settings', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {} finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid #f0f0f0', flexShrink: 0, gap: 6 }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#111' }}>Driver Behavior Settings</span>
        <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 4, borderRadius: 6, display: 'flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 20, textAlign: 'center', fontSize: 11.5, color: '#bbb' }}>Loading…</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={SECT}>Detection Thresholds</div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {field('Overspeed Threshold', 'overspeedThreshold', 'km/h')}
            {field('Harsh Brake Deceleration', 'harshBrakeDeceleration', 'g')}
            {field('Rapid Acceleration', 'rapidAccelThreshold', 'g')}
            {field('Sharp Turn Angle', 'sharpTurnAngle', 'deg')}
            {field('Sharp Turn Min Speed', 'sharpTurnMinSpeed', 'km/h')}
          </div>

          <div style={SECT}>Score Deductions</div>
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {field('Per Harsh Brake', 'deductionHarshBrake', 'pts')}
            {field('Per Rapid Acceleration', 'deductionRapidAccel', 'pts')}
            {field('Per Sharp Turn', 'deductionSharpTurn', 'pts')}
            {field('Per Overspeed', 'deductionOverspeed', 'pts')}
          </div>
        </div>
      )}

      <div style={{ padding: '10px 12px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
        <button onClick={save} disabled={saving || loading}
          style={{ width: '100%', padding: '8px', borderRadius: 6, border: 'none', background: saved ? '#16a34a' : '#dc2626', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: (saving || loading) ? 'not-allowed' : 'pointer', opacity: (saving || loading) ? 0.7 : 1 }}>
          {saved ? 'Saved' : saving ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
