import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { MOBILE_ALERT_SOUNDS } from '../lib/pushNotifications';
import { theme } from '../theme';

export type MobileAlertSoundId = typeof MOBILE_ALERT_SOUNDS[number]['id'];

export function AlertSoundSettings({ enabled, soundEnabled, soundId, onSoundEnabledChange, onSoundIdChange }: {
  enabled: boolean;
  soundEnabled: boolean;
  soundId: MobileAlertSoundId;
  onSoundEnabledChange: (value: boolean) => void;
  onSoundIdChange: (value: MobileAlertSoundId) => void;
}) {
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
        return <Pressable key={tone.id} onPress={() => onSoundIdChange(tone.id)} style={[styles.option, index > 0 && styles.separator]} accessibilityRole="radio" accessibilityState={{ selected }}>
          <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioDot} /> : null}</View>
          <Text style={[styles.optionText, selected && styles.selectedText]}>{tone.label}</Text>
          {selected ? <Text style={styles.selectedMark}>Selected</Text> : null}
        </Pressable>;
      })}
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  container: { paddingTop: 12, marginTop: 10, borderTopWidth: 1, borderTopColor: theme.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { color: theme.ink, fontSize: 12, fontWeight: '700' },
  hint: { color: theme.secondary, fontSize: 11, lineHeight: 16, marginTop: 3 },
  options: { marginTop: 6 },
  option: { minHeight: 38, flexDirection: 'row', alignItems: 'center', gap: 10 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 1, borderColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: theme.red },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.red },
  optionText: { flex: 1, color: theme.secondary, fontSize: 12 },
  selectedText: { color: theme.ink, fontWeight: '600' },
  selectedMark: { color: theme.red, fontSize: 10, fontWeight: '600' },
});
