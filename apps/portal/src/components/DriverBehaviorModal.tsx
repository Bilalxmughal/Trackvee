import { useState, useEffect } from 'react';
import { IconActivity } from '@tabler/icons-react';
import api from '../api/client';

interface LeaderboardRow {
  scoreId: string;
  vehicleId: string;
  vehicleLicensePlate: string | null;
  vehicleName: string | null;
  vehicleMake: string | null;
  vehicleModel: string | null;
  score: number;
  harshBrakeCount: number;
  rapidAccelCount: number;
  sharpTurnCount: number;
  overspeedCount: number;
}

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

const DEFAULT_SETTINGS: BehaviorSettings = {
  overspeedThreshold: 100, harshBrakeDeceleration: 0.4, rapidAccelThreshold: 0.3,
  sharpTurnAngle: 45, sharpTurnMinSpeed: 30,
  deductionHarshBrake: 5, deductionRapidAccel: 5, deductionSharpTurn: 3, deductionOverspeed: 2,
};

function scoreColor(s: number) { return s >= 80 ? '#16a34a' : s >= 60 ? '#f59e0b' : '#dc2626'; }
function scoreBg(s: number) { return s >= 80 ? '#f0fdf4' : s >= 60 ? '#fffbeb' : '#fef2f2'; }

function SettingsForm() {
  const [form, setForm] = useState<BehaviorSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<BehaviorSettings>('/driver-behavior/settings')
      .then(r => { if (r.data) setForm(r.data); })
      .catch(() => {});
  }, []);

  const update = (k: keyof BehaviorSettings, v: string) => { setForm(f => ({ ...f, [k]: parseFloat(v) || 0 })); setSaved(false); };
  const save = async () => { setSaving(true); try { await api.put('/driver-behavior/settings', form); setSaved(true); } catch {} finally { setSaving(false); } };

  const inp: React.CSSProperties = { height: 30, padding: '0 8px', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: 12, color: '#111', background: '#fff', outline: 'none', width: 90 };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280', minWidth: 220 };
  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 };

  const threshFields: { key: keyof BehaviorSettings; title: string; unit: string }[] = [
    { key: 'overspeedThreshold',     title: 'Overspeed Threshold',      unit: 'km/h' },
    { key: 'harshBrakeDeceleration', title: 'Harsh Brake Deceleration', unit: 'km/h/s' },
    { key: 'rapidAccelThreshold',    title: 'Rapid Acceleration',       unit: 'km/h/s' },
    { key: 'sharpTurnAngle',         title: 'Sharp Turn Angle',         unit: 'degrees' },
    { key: 'sharpTurnMinSpeed',      title: 'Sharp Turn Min Speed',     unit: 'km/h' },
  ];
  const deductFields: { key: keyof BehaviorSettings; title: string }[] = [
    { key: 'deductionHarshBrake', title: 'Harsh Brake Deduction' },
    { key: 'deductionRapidAccel', title: 'Rapid Accel Deduction' },
    { key: 'deductionSharpTurn',  title: 'Sharp Turn Deduction' },
    { key: 'deductionOverspeed',  title: 'Overspeed Deduction' },
  ];

  return (
    <div style={{ maxWidth: 520, padding: '20px 24px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Detection Thresholds</div>
        {threshFields.map(f => (
          <div key={f.key} style={row}>
            <span style={labelStyle}>{f.title}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}
              onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
              onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>{f.unit}</span>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Score Deductions (points per event)</div>
        {deductFields.map(f => (
          <div key={f.key} style={row}>
            <span style={labelStyle}>{f.title}</span>
            <input style={inp} type="number" value={form[f.key]} onChange={e => update(f.key, e.target.value)}
              onFocus={ev => ev.currentTarget.style.borderColor = '#dc2626'}
              onBlur={ev => ev.currentTarget.style.borderColor = '#e5e7eb'} />
            <span style={{ fontSize: 11, color: '#9ca3af' }}>pts</span>
          </div>
        ))}
      </div>
      <button onClick={save} disabled={saving} style={{ height: 32, padding: '0 16px', background: saved ? '#16a34a' : '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}
      </button>
    </div>
  );
}

export default function DriverBehaviorModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'scores' | 'settings'>('scores');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<LeaderboardRow[]>('/driver-behavior/leaderboard')
      .then(r => setRows(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const sorted = [...rows].sort((a, b) => b.score - a.score);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9998, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: 'min(900px, 96vw)', height: 'min(680px, 94vh)', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.4)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #f0f0f0', gap: 8, flexShrink: 0 }}>
          <IconActivity size={16} color="#dc2626" strokeWidth={1.75} />
          <span style={{ flex: 1, fontSize: 15, fontWeight: 700, color: '#111' }}>Driver Behavior</span>
          <button onClick={onClose} style={{ background: '#f5f5f5', border: 'none', cursor: 'pointer', color: '#666', padding: '4px 5px', borderRadius: 5, display: 'flex' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0', padding: '0 16px', gap: 0, flexShrink: 0 }}>
          {(['scores', 'settings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '8px 14px', fontSize: 12, fontWeight: tab === t ? 600 : 400,
              color: tab === t ? '#dc2626' : '#9ca3af',
              background: 'none', border: 'none', borderBottom: `2px solid ${tab === t ? '#dc2626' : 'transparent'}`,
              cursor: 'pointer', marginBottom: -1,
            }}>
              {t === 'scores' ? 'Driver Scores' : 'Settings'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {tab === 'scores' && (
            loading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#bbb', fontSize: 13 }}>Loading…</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                    {['#', 'Vehicle No', 'Vehicle Name', 'Score', 'Harsh Brake', 'Rapid Accel', 'Sharp Turn', 'Overspeed'].map((h, i) => (
                      <th key={i} style={{ padding: '9px 14px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: ['Score','Harsh Brake','Rapid Accel','Sharp Turn','Overspeed'].includes(h) ? 'center' : 'left', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr><td colSpan={8} style={{ padding: '40px 16px', textAlign: 'center', color: '#ccc', fontSize: 13 }}>No driver behavior data yet.</td></tr>
                  ) : sorted.map((row, i) => (
                    <tr key={row.scoreId} style={{ borderBottom: '1px solid #f7f7f7', borderLeft: `3px solid ${scoreColor(row.score)}` }}>
                      <td style={{ padding: '10px 14px', color: '#9ca3af', fontSize: 12 }}>{i + 1}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 500, fontSize: 13 }}>{row.vehicleLicensePlate ?? <span style={{ color: '#ccc' }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', fontSize: 13 }}>{[row.vehicleMake, row.vehicleModel].filter(Boolean).join(' ') || row.vehicleName || <span style={{ color: '#ccc' }}>—</span>}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <span style={{ display: 'inline-block', minWidth: 38, padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontSize: 12, color: scoreColor(row.score), background: scoreBg(row.score) }}>
                          {row.score.toFixed(0)}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.harshBrakeCount > 0 ? '#f59e0b' : '#ccc' }}>{row.harshBrakeCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.rapidAccelCount > 0 ? '#f59e0b' : '#ccc' }}>{row.rapidAccelCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.sharpTurnCount > 0 ? '#f59e0b' : '#ccc' }}>{row.sharpTurnCount}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: 13, color: row.overspeedCount > 0 ? '#dc2626' : '#ccc' }}>{row.overspeedCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {tab === 'settings' && <SettingsForm />}
        </div>

        {tab === 'scores' && sorted.length > 0 && (
          <div style={{ padding: '6px 16px', borderTop: '1px solid #f0f0f0', flexShrink: 0 }}>
            <span style={{ fontSize: 11.5, color: '#bbb' }}>{sorted.length} vehicles</span>
          </div>
        )}
      </div>
    </div>
  );
}
