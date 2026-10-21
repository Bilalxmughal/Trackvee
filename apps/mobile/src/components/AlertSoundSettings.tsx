import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import type { AudioSource } from 'expo-audio';
import { MOBILE_ALERT_SOUNDS, syncPushRegistration } from '../lib/pushNotifications';
import { cacheDynamicNotificationSound, getDynamicNotificationSounds } from '../lib/dynamicNotificationSounds';
import type { DynamicNotificationSound } from '../lib/dynamicNotificationSounds';
import { useTheme } from '../hooks/useTheme';
import type { AppTheme } from '../theme';
import { TablerIcon } from './TablerIcon';

export type MobileAlertSoundId = string;

const PREVIEW_SOURCES: Record<typeof MOBILE_ALERT_SOUNDS[number]['id'], AudioSource> = {
  trackvee: require('../../assets/trackvee_alert.wav'),
  chime: require('../../assets/trackvee_chime.wav'),
  pulse: require('../../assets/trackvee_pulse.wav'),
  bell: require('../../assets/trackvee_bell.wav'),
  soft: require('../../assets/trackvee_soft.wav'),
};

function SoundPreview({ source, onFinish }: { source: AudioSource; onFinish: () => void }) {
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' });
        if (mounted) {
          player.seekTo(0);
          player.play();
        }
      } catch {
        if (mounted) onFinishRef.current();
      }
    })();
    return () => {
      mounted = false;
      // useAudioPlayer releases the native shared object on unmount and pauses it
      // during native teardown. Calling pause here can run after that release.
    };
  }, [player]);

  useEffect(() => {
    if (status.didJustFinish) onFinishRef.current();
  }, [status.didJustFinish]);

  return null;
}

export function AlertSoundSettings({ enabled, soundEnabled, soundId, onSoundEnabledChange, onSoundIdChange }: {
  enabled: boolean;
  soundEnabled: boolean;
  soundId: MobileAlertSoundId;
  onSoundEnabledChange: (value: boolean) => void;
  onSoundIdChange: (value: MobileAlertSoundId) => void;
}) {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const [previewId, setPreviewId] = useState<MobileAlertSoundId | null>(null);
  const [previewSource, setPreviewSource] = useState<AudioSource | null>(null);
  const [customSounds, setCustomSounds] = useState<DynamicNotificationSound[]>([]);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => {
    let active = true;
    void getDynamicNotificationSounds().then(sounds => {
      if (!active) return;
      setCustomSounds(sounds);
      if (sounds.length) void syncPushRegistration(false).catch(() => {});
    }).catch(() => {});
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!enabled || !soundEnabled) { setPreviewId(null); setPreviewSource(null); }
  }, [enabled, soundEnabled]);
  if (!enabled) return null;
  const allSounds: { id: string; name: string; custom: boolean }[] = [
    ...MOBILE_ALERT_SOUNDS.map(tone => ({ id: tone.id, name: tone.label, custom: false as const })),
    ...customSounds.map(tone => ({ id: tone.id, name: tone.name, custom: true as const, tone })),
  ];
  if (soundEnabled && soundId && !allSounds.some(tone => tone.id === soundId)) {
    allSounds.push({ id: soundId, name: 'Saved sound unavailable', custom: true as const });
  }
  const playPreview = async (toneId: string) => {
    setPreviewError('');
    if (previewId === toneId) { setPreviewId(null); setPreviewSource(null); return; }
    try {
      const custom = customSounds.find(tone => tone.id === toneId);
      const source = custom ? { uri: (await cacheDynamicNotificationSound(custom)).uri } : PREVIEW_SOURCES[toneId as keyof typeof PREVIEW_SOURCES];
      if (!source) throw new Error('Unavailable');
      setPreviewId(toneId);
      setPreviewSource(source);
    } catch { setPreviewId(null); setPreviewSource(null); setPreviewError('This sound preview is unavailable.'); }
  };
  return <View style={styles.container}>
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.title}>Notification sound</Text>
        <Text style={styles.hint}>Choose whether this alert plays a sound.</Text>
      </View>
      <Switch value={soundEnabled} onValueChange={onSoundEnabledChange} trackColor={{ true: t.red }} accessibilityLabel="Notification sound" />
    </View>
    {soundEnabled ? <View style={styles.options}>
      {allSounds.map((tone, index) => {
        const selected = soundId === tone.id;
        const previewing = previewId === tone.id;
        const available = !tone.custom || customSounds.some(sound => sound.id === tone.id);
        return <View key={tone.id} style={[styles.option, index > 0 && styles.separator]}>
          <Pressable onPress={() => { if (available) onSoundIdChange(tone.id); }} style={styles.selectTone} accessibilityRole="radio" accessibilityState={{ selected, disabled: !available }} accessibilityLabel={`${tone.name} notification sound`}>
            <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            <Text style={[styles.optionText, selected && styles.selectedText, !available && { color: t.muted }]}>{tone.name}</Text>
            {selected ? <Text style={styles.selectedMark}>Selected</Text> : null}
          </Pressable>
          {available ? <Pressable onPress={() => void playPreview(tone.id)} style={[styles.previewButton, previewing && styles.previewButtonActive]} accessibilityRole="button" accessibilityLabel={`${previewing ? 'Stop' : 'Play'} ${tone.name} sound preview`}>
            <TablerIcon name={previewing ? 'pause' : 'play'} size={13} color={previewing ? '#fff' : t.red} />
            <Text style={[styles.previewText, previewing && styles.previewTextActive]}>{previewing ? 'Stop' : 'Play'}</Text>
          </Pressable> : null}
        </View>;
      })}
    </View> : null}
    {previewError ? <Text style={styles.hint}>{previewError}</Text> : null}
    {soundEnabled && previewId && previewSource ? <SoundPreview key={previewId} source={previewSource} onFinish={() => { setPreviewId(current => current === previewId ? null : current); setPreviewSource(null); }} /> : null}
  </View>;
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  container: { paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: t.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: t.ink, fontSize: 12, fontWeight: '700' },
  hint: { color: t.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  options: { marginTop: 6 },
  option: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectTone: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: t.red },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: t.red },
  optionText: { flex: 1, color: t.secondary, fontSize: 12 },
  selectedText: { color: t.ink, fontWeight: '600' },
  selectedMark: { color: t.red, fontSize: 10, fontWeight: '600' },
  previewButton: { minWidth: 66, height: 29, borderWidth: 1, borderColor: t.border, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  previewButtonActive: { backgroundColor: t.red, borderColor: t.red },
  previewText: { color: t.red, fontSize: 10, fontWeight: '600' },
  previewTextActive: { color: '#fff' },
}); }
