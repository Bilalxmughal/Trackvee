import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import { getAlertSoundEnabled, getFleetRefreshOnResume, hasCachedPushRegistration, isPushNotificationsEnabled, setAlertSoundEnabled, setFleetRefreshOnResume, syncAlertSoundPreference, syncPushRegistration, unregisterPushToken } from '../src/lib/pushNotifications';
import { useTheme } from '../src/hooks/useTheme';

export default function SettingsScreen() {
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const t = useTheme();
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

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: t.border }]}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <TablerIcon name="arrow-left" size={20} color={t.ink} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: t.ink }]}>Settings</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading || permissionsLoading ? (
        <View style={styles.loader}><ActivityIndicator color={t.red} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

          {/* Notifications */}
          {canDo('alerts') ? (
            <>
              <SectionLabel label="NOTIFICATIONS" t={t} />
              <View style={[styles.card, { backgroundColor: t.card }]}>
                <ToggleRow
                  icon="bell"
                  iconBg="#EF44440f"
                  iconColor="#EF4444"
                  title="Push Notifications"
                  sub="Receive fleet alerts on this device"
                  value={pushEnabled}
                  disabled={pushBusy}
                  onChange={togglePush}
                  t={t}
                />
                <View style={[styles.divider, { backgroundColor: t.border }]} />
                <ToggleRow
                  icon="sun"
                  iconBg="#F59E0B0f"
                  iconColor="#F59E0B"
                  title="Alert Sounds"
                  sub="Play sound set on each alert rule"
                  value={soundEnabled}
                  disabled={soundBusy || !pushEnabled}
                  onChange={toggleSound}
                  t={t}
                  last
                />
              </View>
              {!pushEnabled && (
                <Text style={[styles.hint, { color: t.muted }]}>
                  Enable push notifications to change sound delivery.
                </Text>
              )}
            </>
          ) : (
            <>
              <SectionLabel label="NOTIFICATIONS" t={t} />
              <View style={[styles.card, { backgroundColor: t.card }]}>
                <View style={styles.noAccessRow}>
                  <View style={[styles.iconWrap, { backgroundColor: '#6B72800f' }]}>
                    <TablerIcon name="bell" size={18} color="#6B7280" />
                  </View>
                  <Text style={[styles.noAccessText, { color: t.secondary }]}>
                    Alert access not enabled for this account.
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Fleet Data */}
          <SectionLabel label="FLEET DATA" t={t} />
          <View style={[styles.card, { backgroundColor: t.card }]}>
            <ToggleRow
              icon="refresh"
              iconBg="#10B9810f"
              iconColor="#10B981"
              title="Refresh on Return"
              sub="Fetch positions when app comes to foreground"
              value={refreshOnResume}
              onChange={toggleRefresh}
              t={t}
              last
            />
          </View>
          <Text style={[styles.hint, { color: t.muted }]}>
            The OS may suspend apps in the background. This setting refreshes data on return — it does not run continuous GPS tracking.
          </Text>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function SectionLabel({ label, t }: { label: string; t: ReturnType<typeof useTheme> }) {
  return <Text style={[styles.sectionLabel, { color: t.secondary }]}>{label}</Text>;
}

function ToggleRow({ icon, iconBg, iconColor, title, sub, value, disabled, onChange, t, last }: {
  icon: string; iconBg: string; iconColor: string;
  title: string; sub: string; value: boolean; disabled?: boolean;
  onChange: (v: boolean) => void; t: ReturnType<typeof useTheme>; last?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && styles.dimmed]}>
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <TablerIcon name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.toggleText}>
        <Text style={[styles.toggleTitle, { color: t.ink }]}>{title}</Text>
        <Text style={[styles.toggleSub, { color: t.secondary }]}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: '#d1d5db', true: t.red }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40 },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },

  card: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },

  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 13 },
  dimmed: { opacity: 0.45 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  toggleText: { flex: 1 },
  toggleTitle: { fontSize: 14, fontWeight: '600' },
  toggleSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },

  divider: { height: StyleSheet.hairlineWidth, marginLeft: 67 },

  noAccessRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 13 },
  noAccessText: { flex: 1, fontSize: 13, lineHeight: 18 },

  hint: { fontSize: 11.5, lineHeight: 17, marginTop: 8, paddingHorizontal: 4 },
});
