import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import { getAlertSoundEnabled, getFleetRefreshOnResume, hasCachedPushRegistration, isPushNotificationsEnabled, setAlertSoundEnabled, setFleetRefreshOnResume, syncAlertSoundPreference, syncPushRegistration, unregisterPushToken } from '../src/lib/pushNotifications';
import { useTheme } from '../src/hooks/useTheme';
import { useThemeContext, type ThemeMode } from '../src/contexts/ThemeContext';
import type { AppTheme } from '../src/theme';

const MODES: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
  { mode: 'system', label: 'System', icon: 'device-desktop' },
];

export default function SettingsScreen() {
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const t = useTheme();
  const { themeMode, setThemeMode } = useThemeContext();
  const s = useMemo(() => createStyles(t), [t]);
  const [loading, setLoading] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundBusy, setSoundBusy] = useState(false);
  const [refreshOnResume, setRefreshOnResumeState] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sound, refresh, registered, preference, permission] = await Promise.all([
        getAlertSoundEnabled(),
        getFleetRefreshOnResume(),
        hasCachedPushRegistration(),
        isPushNotificationsEnabled(),
        Notifications.getPermissionsAsync().catch(() => null),
      ]);
      setSoundEnabled(sound);
      setRefreshOnResumeState(refresh);
      setPushEnabled(registered && preference && Boolean(permission?.granted));
    } catch {
      Alert.alert('Settings unavailable', 'Your preferences could not be loaded. Please try again.');
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const togglePush = async (enabled: boolean) => {
    if (!canDo('alerts')) return;
    setPushBusy(true);
    try {
      if (enabled) {
        const result = await syncPushRegistration(true, soundEnabled);
        if (result !== 'enabled') {
          if (result === 'denied') Alert.alert('Notifications are off', 'Allow notifications for Trackvee in your device settings.', [{ text: 'Not now', style: 'cancel' }, { text: 'Open settings', onPress: () => { void Linking.openSettings(); } }]);
          else if (result === 'unconfigured') Alert.alert('Push not configured', 'Push notifications are not configured for this app build yet.');
          else Alert.alert('Notifications unavailable', 'Push notifications are available in the iOS and Android app.');
          return;
        }
        setPushEnabled(true);
      } else {
        await unregisterPushToken(true);
        setPushEnabled(false);
      }
    } catch {
      Alert.alert('Update failed', 'Notification preferences could not be updated. Please check your connection and try again.');
    } finally { setPushBusy(false); }
  };

  const toggleSound = async (enabled: boolean) => {
    setSoundBusy(true);
    try {
      await setAlertSoundEnabled(enabled);
      await syncAlertSoundPreference(enabled);
      setSoundEnabled(enabled);
    } catch {
      await setAlertSoundEnabled(!enabled).catch(() => {});
      Alert.alert('Update failed', 'The alert sound preference could not be synced. Please try again.');
    } finally { setSoundBusy(false); }
  };

  const toggleRefresh = async (enabled: boolean) => {
    try {
      await setFleetRefreshOnResume(enabled);
      setRefreshOnResumeState(enabled);
    } catch { Alert.alert('Update failed', 'The refresh preference could not be saved. Please try again.'); }
  };

  return <SafeAreaView style={s.container} edges={['top']}>
    <View style={s.header}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back" style={s.back}><TablerIcon name="back" size={20} color={t.ink}/></Pressable>
      <View style={s.headerTitleWrap}><Text style={s.title}>Settings</Text><Text style={s.subtitle}>Notifications, appearance and fleet updates</Text></View>
    </View>
    {loading || permissionsLoading ? <View style={s.loading}><ActivityIndicator color={t.red}/></View> : <ScrollView contentContainerStyle={s.content}>
      <Text style={s.section}>APPEARANCE</Text>
      <View style={s.pills}>
        {MODES.map(({ mode, label, icon }) => (
          <Pressable key={mode} onPress={() => setThemeMode(mode)} style={[s.pill, themeMode === mode && s.pillActive]}>
            <TablerIcon name={icon} size={14} color={themeMode === mode ? '#fff' : t.secondary} />
            <Text style={[s.pillText, { color: themeMode === mode ? '#fff' : t.secondary }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {canDo('alerts') ? <>
        <Text style={s.section}>NOTIFICATIONS</Text>
        <PreferenceRow title="Mobile push notifications" description="Receive enabled fleet alerts on this device, including while Trackvee is closed." value={pushEnabled} disabled={pushBusy} onChange={togglePush} s={s} t={t} />
        <PreferenceRow title="Alert sounds" description="Play the sound chosen by each alert rule. Muted rules stay silent." value={soundEnabled} disabled={soundBusy || !pushEnabled} onChange={toggleSound} s={s} t={t} />
        {!pushEnabled ? <Text style={s.note}>Enable mobile push to change sound delivery. Sound choices can still be set on each alert rule.</Text> : null}
      </> : <Text style={s.note}>Alert preferences are unavailable because this account does not have Alerts access.</Text>}

      <Text style={s.section}>FLEET DATA</Text>
      <PreferenceRow title="Refresh when returning to Trackvee" description="Fetch vehicle positions immediately when the app returns to the foreground. Live polling pauses in the background; regular foreground updates resume afterward." value={refreshOnResume} onChange={toggleRefresh} s={s} t={t} />
      <View style={s.info}><TablerIcon name="refresh" size={16} color={t.secondary}/><Text style={s.infoText}>The operating system may suspend apps in the background. This setting refreshes data on return; it does not run continuous GPS tracking.</Text></View>
    </ScrollView>}
  </SafeAreaView>;
}

function PreferenceRow({ title, description, value, disabled, onChange, s, t }: { title: string; description: string; value: boolean; disabled?: boolean; onChange: (value: boolean) => void; s: ReturnType<typeof createStyles>; t: AppTheme }) {
  return <View style={[s.row, disabled && s.disabled]}>
    <View style={s.copy}><Text style={s.rowTitle}>{title}</Text><Text style={s.rowDescription}>{description}</Text></View>
    <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: '#d1d5db', true: t.red }} thumbColor="#fff" accessibilityLabel={title}/>
  </View>;
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { minHeight: 70, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, borderBottomWidth: 1, borderColor: t.border, gap: 10 },
    back: { width: 38, height: 42, justifyContent: 'center' }, headerTitleWrap: { flex: 1 }, title: { color: t.ink, fontSize: 17, fontWeight: '700' }, subtitle: { color: t.secondary, fontSize: 11, marginTop: 3 },
    content: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 30 }, section: { color: t.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, marginTop: 24, marginBottom: 7 },
    pills: { flexDirection: 'row', gap: 8, marginBottom: 4 },
    pill: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: 8, borderWidth: 1.5, borderColor: t.border, backgroundColor: t.bg2 },
    pillActive: { borderColor: t.red, backgroundColor: t.red },
    pillText: { fontSize: 12, fontWeight: '600' },
    row: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderColor: t.border, paddingVertical: 12 }, copy: { flex: 1 }, rowTitle: { color: t.ink, fontSize: 13, fontWeight: '600' }, rowDescription: { color: t.secondary, fontSize: 11, lineHeight: 16, marginTop: 4 }, disabled: { opacity: 0.5 },
    note: { color: t.secondary, fontSize: 11, lineHeight: 17, marginTop: 9 }, info: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, marginTop: 13, paddingVertical: 11 }, infoText: { flex: 1, color: t.secondary, fontSize: 10, lineHeight: 16 }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  });
}
