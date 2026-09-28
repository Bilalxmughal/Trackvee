import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { MOBILE_ALERT_SOUNDS } from '../lib/pushNotifications';
import { theme } from '../theme';
import { TablerIcon } from './TablerIcon';

export type MobileAlertSoundId = typeof MOBILE_ALERT_SOUNDS[number]['id'];

const PREVIEW_SOURCES = {
  trackvee: require('../../assets/trackvee_alert.wav'),
  chime: require('../../assets/trackvee_chime.wav'),
  pulse: require('../../assets/trackvee_pulse.wav'),
  bell: require('../../assets/trackvee_bell.wav'),
  soft: require('../../assets/trackvee_soft.wav'),
};

function SoundPreview({ soundId, onFinish }: { soundId: MobileAlertSoundId; onFinish: () => void }) {
  const player = useAudioPlayer(PREVIEW_SOURCES[soundId]);
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
        onFinishRef.current();
      }
    })();
    return () => {
      mounted = false;
      player.pause();
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
  const [previewId, setPreviewId] = useState<MobileAlertSoundId | null>(null);
  useEffect(() => {
    if (!enabled || !soundEnabled) setPreviewId(null);
  }, [enabled, soundEnabled]);
  if (!enabled) return null;
  return <View style={styles.container}>
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.title}>Notification sound</Text>
        <Text style={styles.hint}>Choose whether this alert plays a sound.</Text>
      </View>
      <Switch value={soundEnabled} onValueChange={onSoundEnabledChange} trackColor={{ true: theme.red }} accessibilityLabel="Notification sound" />
    </View>
    {soundEnabled ? <View style={styles.options}>
      {MOBILE_ALERT_SOUNDS.map((tone, index) => {
        const selected = soundId === tone.id;
        const previewing = previewId === tone.id;
        return <View key={tone.id} style={[styles.option, index > 0 && styles.separator]}>
          <Pressable onPress={() => onSoundIdChange(tone.id)} style={styles.selectTone} accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={`${tone.label} notification sound`}>
            <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
            <Text style={[styles.optionText, selected && styles.selectedText]}>{tone.label}</Text>
            {selected ? <Text style={styles.selectedMark}>Selected</Text> : null}
          </Pressable>
          <Pressable onPress={() => setPreviewId(current => current === tone.id ? null : tone.id)} style={[styles.previewButton, previewing && styles.previewButtonActive]} accessibilityRole="button" accessibilityLabel={`${previewing ? 'Stop' : 'Play'} ${tone.label} sound preview`}>
            <TablerIcon name={previewing ? 'pause' : 'play'} size={13} color={previewing ? '#fff' : theme.red} />
            <Text style={[styles.previewText, previewing && styles.previewTextActive]}>{previewing ? 'Stop' : 'Play'}</Text>
          </Pressable>
        </View>;
      })}
    </View> : null}
    {soundEnabled && previewId ? <SoundPreview key={previewId} soundId={previewId} onFinish={() => setPreviewId(current => current === previewId ? null : current)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: theme.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: theme.ink, fontSize: 12, fontWeight: '700' },
  hint: { color: theme.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  options: { marginTop: 6 },
  option: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectTone: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.red },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.red },
  optionText: { flex: 1, color: theme.secondary, fontSize: 12 },
  selectedText: { color: theme.ink, fontWeight: '600' },
  selectedMark: { color: theme.red, fontSize: 10, fontWeight: '600' },
  previewButton: { minWidth: 66, height: 29, borderWidth: 1, borderColor: theme.border, borderRadius: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  previewButtonActive: { backgroundColor: theme.red, borderColor: theme.red },
  previewText: { color: theme.red, fontSize: 10, fontWeight: '600' },
  previewTextActive: { color: '#fff' },
});
