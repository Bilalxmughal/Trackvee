import { useEffect, useRef, useState } from 'react';
import { IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react';
import api from '../api/client';

interface Sound { id: string; name: string; isActive: boolean; }
const BUILT_IN = [
  { id: 'trackvee', name: 'Trackvee' }, { id: 'chime', name: 'Chime' }, { id: 'pulse', name: 'Pulse' },
  { id: 'bell', name: 'Bell' }, { id: 'soft', name: 'Soft' },
];

export default function AlertSoundPicker({ value, dark, onChange }: { value: string; dark: boolean; onChange: (id: string) => void }) {
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [playing, setPlaying] = useState(false);
  const audio = useRef<HTMLAudioElement | null>(null);
  const objectUrl = useRef<string | null>(null);
  useEffect(() => { api.get<Sound[]>('/alerts/sounds?includeInactive=true').then(r => setSounds(r.data)).catch(() => {}); return () => { audio.current?.pause(); if (objectUrl.current) URL.revokeObjectURL(objectUrl.current); }; }, []);
  const custom = sounds.find(sound => sound.id === value);
  const isBuiltIn = BUILT_IN.some(sound => sound.id === value);
  async function preview() {
    if (playing) { audio.current?.pause(); setPlaying(false); return; }
    try {
      const { data } = await api.get<Blob>(`/alerts/sounds/${value}/audio`, { responseType: 'blob' });
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const url = URL.createObjectURL(data); objectUrl.current = url;
      const player = new Audio(url); audio.current = player; player.onended = () => setPlaying(false); player.onerror = () => setPlaying(false);
      await player.play(); setPlaying(true);
    } catch { setPlaying(false); }
  }
  return <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
    <select value={value} onChange={e => onChange(e.target.value)} aria-label="Mobile alert sound" style={{ flex: 1, minWidth: 0, height: 32, border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, borderRadius: 6, background: dark ? '#161616' : '#fff', color: dark ? '#ddd' : '#333', padding: '0 8px', fontSize: 11 }}>
      {BUILT_IN.map(sound => <option key={sound.id} value={sound.id}>{sound.name}</option>)}
      {sounds.length > 0 && <optgroup label="Uploaded sounds">{sounds.map(sound => <option key={sound.id} value={sound.id}>{sound.name}</option>)}</optgroup>}
      {!custom && !isBuiltIn && <option value={value} disabled>Saved sound unavailable</option>}
      {custom && !custom.isActive && <option value={custom.id} disabled>{custom.name} (Inactive)</option>}
    </select>
    {custom?.isActive && <button type="button" onClick={() => void preview()} aria-label={playing ? 'Stop sound preview' : 'Play sound preview'} style={{ width: 34, height: 32, display: 'grid', placeItems: 'center', border: `1px solid ${dark ? '#333' : '#e5e7eb'}`, borderRadius: 6, background: 'transparent', color: '#dc2626', cursor: 'pointer' }}>{playing ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}</button>}
  </div>;
}
