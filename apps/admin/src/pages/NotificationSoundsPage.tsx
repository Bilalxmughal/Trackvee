import { FormEvent, useEffect, useRef, useState } from 'react';
import { IconBellRinging, IconPlayerPause, IconPlayerPlay, IconPlus, IconUpload } from '@tabler/icons-react';
import api from '../api/client';
import PageHeader from '../components/PageHeader';
import { useTheme } from '../contexts/ThemeContext';
import { useToast } from '../contexts/ToastContext';

interface Sound {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  durationMs: number;
  isActive: boolean;
  createdAt: string;
}

const MAX_UPLOAD_BYTES = 900 * 1024;

export default function NotificationSoundsPage({ embedded = false }: { embedded?: boolean }) {
  const { dark } = useTheme();
  const { toast } = useToast();
  const [sounds, setSounds] = useState<Sound[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const border = dark ? '#2a2a2a' : '#e5e7eb';
  const surface = dark ? '#1a1a1a' : '#fff';
  const secondary = dark ? '#999' : '#6b7280';

  const load = () => api.get<Sound[]>('/alerts/sounds?includeInactive=true').then(r => setSounds(r.data)).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => {
    void load();
    return () => {
      audioRef.current?.pause();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  async function upload(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!file) { setError('Choose a WAV file to upload.'); return; }
    if (!file.name.toLowerCase().endsWith('.wav') || file.size > MAX_UPLOAD_BYTES) {
      setError('Choose a PCM WAV file smaller than 900 KB.'); return;
    }
    setSaving(true);
    try {
      const body = new FormData();
      body.append('name', name.trim());
      body.append('file', file);
      await api.post('/alerts/sounds', body);
      setName(''); setFile(null);
      const input = document.getElementById('notification-sound-file') as HTMLInputElement | null;
      if (input) input.value = '';
      setLoading(true);
      await load();
      toast('Sound uploaded successfully');
    } catch (e: unknown) {
      const message = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast(typeof message === 'string' ? message : 'Sound upload failed. Check that the file is a supported PCM WAV.', 'error');
    } finally { setSaving(false); }
  }

  async function toggleActive(sound: Sound) {
    try {
      const { data } = await api.patch<Sound>(`/alerts/sounds/${sound.id}`, { isActive: !sound.isActive });
      setSounds(current => current.map(item => item.id === sound.id ? data : item));
      toast(data.isActive ? 'Sound activated' : 'Sound deactivated');
    } catch { toast('Could not update sound status.', 'error'); }
  }

  async function preview(sound: Sound) {
    if (playingId === sound.id) { audioRef.current?.pause(); setPlayingId(null); return; }
    audioRef.current?.pause();
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    try {
      const { data } = await api.get<Blob>(`/alerts/sounds/${sound.id}/audio`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      objectUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => { setPlayingId(null); toast('This sound could not be played.', 'error'); };
      await audio.play();
      setPlayingId(sound.id);
    } catch { toast('Could not preview this sound.', 'error'); }
  }

  return <div>
    {!embedded && <PageHeader title="Notification Sounds" count={sounds.length} />}
    <div style={{ padding: embedded ? '20px 24px 24px' : '0 24px 24px', maxWidth: 1100 }}>
      <div style={{ color: secondary, fontSize: 12.5, lineHeight: 1.6, marginBottom: 18 }}>
        Upload a shared alert tone once. Active sounds become available in admin, client portal, and the mobile app. Use 16-bit PCM WAV, up to 30 seconds and 900 KB.
      </div>
      <form onSubmit={upload} style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(220px, 1.2fr) auto', alignItems: 'end', gap: 12, padding: 16, border: `1px solid ${border}`, borderRadius: 8, background: surface, marginBottom: 20 }}>
        <label style={{ display: 'grid', gap: 6, fontSize: 11.5, color: secondary, fontWeight: 600 }}>
          Sound name
          <input value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={60} placeholder="e.g. Fleet Alert" style={{ height: 36, border: `1px solid ${border}`, borderRadius: 6, padding: '0 10px', background: surface, color: dark ? '#eee' : '#111', outline: 'none' }} />
        </label>
        <label style={{ display: 'grid', gap: 6, fontSize: 11.5, color: secondary, fontWeight: 600 }}>
          WAV audio file
          <input id="notification-sound-file" type="file" accept=".wav,audio/wav" required onChange={e => setFile(e.target.files?.[0] ?? null)} style={{ minHeight: 36, color: secondary, fontSize: 11.5 }} />
        </label>
        <button disabled={saving} type="submit" style={{ height: 36, padding: '0 15px', display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', border: 0, borderRadius: 6, color: '#fff', background: saving ? '#f3a3a3' : '#dc2626', fontSize: 12, fontWeight: 600, cursor: saving ? 'wait' : 'pointer', whiteSpace: 'nowrap' }}>
          <IconUpload size={14} /> {saving ? 'Uploading…' : 'Upload Sound'}
        </button>
      </form>
      {error && <div role="alert" style={{ color: '#dc2626', fontSize: 12, marginBottom: 14 }}>{error}</div>}
      <div style={{ border: `1px solid ${border}`, borderRadius: 8, background: surface, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 110px 120px 110px', gap: 12, padding: '10px 14px', borderBottom: `1px solid ${border}`, color: secondary, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase' }}>
          <span>Sound</span><span>Length</span><span>Status</span><span>Preview</span>
        </div>
        {loading ? <div style={{ padding: 20, color: secondary, fontSize: 12 }}>Loading sounds…</div> : sounds.length ? sounds.map(sound => <div key={sound.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) 110px 120px 110px', gap: 12, alignItems: 'center', padding: '11px 14px', borderBottom: `1px solid ${border}`, color: dark ? '#eee' : '#222', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}><IconBellRinging size={15} color="#dc2626" /><div style={{ minWidth: 0 }}><div style={{ fontWeight: 600 }}>{sound.name}</div><div style={{ color: secondary, fontSize: 10.5, marginTop: 3 }}>{sound.fileName}</div></div></div>
          <span style={{ color: secondary }}>{(sound.durationMs / 1000).toFixed(1)} sec</span>
          <button type="button" onClick={() => void toggleActive(sound)} style={{ justifySelf: 'start', border: 0, background: 'transparent', padding: 0, color: sound.isActive ? '#dc2626' : secondary, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>{sound.isActive ? 'Active' : 'Inactive'}</button>
          <button type="button" onClick={() => void preview(sound)} style={{ justifySelf: 'start', display: 'flex', alignItems: 'center', gap: 5, border: `1px solid ${border}`, background: 'transparent', color: '#dc2626', borderRadius: 5, padding: '5px 8px', cursor: 'pointer', fontSize: 11 }}>
            {playingId === sound.id ? <IconPlayerPause size={13} /> : <IconPlayerPlay size={13} />} {playingId === sound.id ? 'Stop' : 'Play'}
          </button>
        </div>) : <div style={{ padding: 24, textAlign: 'center', color: secondary, fontSize: 12 }}>No uploaded sounds yet. Add a WAV tone to make it selectable in alert rules.</div>}
      </div>
    </div>
  </div>;
}
