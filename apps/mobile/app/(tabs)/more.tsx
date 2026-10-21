import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../../src/components/TablerIcon';
import { useTheme } from '../../src/hooks/useTheme';
import { useThemeContext, type ThemeMode } from '../../src/contexts/ThemeContext';

export default function MoreScreen() {
  const t = useTheme();
  const { user, logout } = useAuth();
  const { canDo } = usePortalPermissions();
  const { themeMode, setThemeMode } = useThemeContext();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';
  const signOut = () => Alert.alert('Sign out', 'Are you sure you want to sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => { void logout(); } }]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: t.bg }]} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: t.ink }]}>More</Text>

      <View style={[styles.profile, { borderColor: t.border }]}>
        <View style={[styles.avatar, { backgroundColor: t.bg2 }]}><Text style={[styles.avatarText, { color: t.ink }]}>{name[0]?.toUpperCase() ?? 'U'}</Text></View>
        <View style={styles.profileText}><Text style={[styles.name, { color: t.ink }]}>{name}</Text><Text style={[styles.email, { color: t.secondary }]}>{user?.organizationName || user?.email}</Text></View>
      </View>

      {(canDo('vehicles') || canDo('geofences') || canDo('pois') || canDo('driver-behavior') || canDo('users') || canDo('maintenance')) ? <>
        <Text style={[styles.sectionLabel, styles.accountLabel, { color: t.secondary }]}>FLEET TOOLS</Text>
        {canDo('vehicles') ? <ToolRow icon="cpu" title="Device Health" subtitle="Connection, GPS, signal and power status" t={t} onPress={() => router.push('/device-health')} /> : null}
        {canDo('maintenance') ? <ToolRow icon="tool" title="Maintenance" subtitle="Service history and due reminders" t={t} onPress={() => router.push('/maintenance')} /> : null}
        {canDo('driver-behavior') ? <ToolRow icon="activity" title="Driver Behavior" subtitle="Safety scores, events and settings" t={t} onPress={() => router.push('/behavior')} /> : null}
        {canDo('geofences') ? <ToolRow icon="geofence" title="Geofences" subtitle="Manage circle and polygon zones" t={t} onPress={() => router.push('/geofences')} /> : null}
        {canDo('pois') ? <ToolRow icon="map-pin" title="Points of Interest" subtitle="Manage saved locations" t={t} onPress={() => router.push('/pois')} /> : null}
        {canDo('users') ? <ToolRow icon="user" title="Users" subtitle="Manage accounts and access" t={t} onPress={() => router.push('/users')} /> : null}
        <ToolRow icon="share" title="Share Links" subtitle="Share live vehicle location with anyone" t={t} onPress={() => router.push('/share-links')} />
      </> : null}

      <Text style={[styles.sectionLabel, styles.accountLabel, { color: t.secondary }]}>PREFERENCES</Text>
      <AppearanceRow themeMode={themeMode} setThemeMode={setThemeMode} t={t} />
      <ToolRow icon="settings" title="Settings" subtitle="Notifications and fleet updates" t={t} onPress={() => router.push('/settings')} />

      <Text style={[styles.sectionLabel, styles.accountLabel, { color: t.secondary }]}>ACCOUNT</Text>
      <InfoRow icon="building" title={user?.organizationName || '—'} subtitle="Organization" t={t} />
      <InfoRow icon="shield" title={user?.role.replace('client_', '').replaceAll('_', ' ') || '—'} subtitle="Account role" t={t} />
      <Pressable onPress={signOut} style={[styles.toolRow, { borderColor: t.border }]}>
        <View style={styles.toolIcon}><TablerIcon name="logout" size={19} color={t.red} /></View>
        <Text style={[styles.toolTitle, { color: t.red }]}>Sign out</Text>
      </Pressable>
      <Text style={[styles.version, { color: t.muted }]}>Trackvee Mobile · Expo SDK 57</Text>
    </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, title, subtitle, t }: { icon: string; title: string; subtitle: string; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.toolRow, { borderColor: t.border }]}>
      <View style={styles.toolIcon}><TablerIcon name={icon} size={19} color={t.red} /></View>
      <View style={styles.toolText}>
        <Text style={[styles.toolTitle, { color: t.ink }]} numberOfLines={1}>{title}</Text>
        <Text style={[styles.toolSubtitle, { color: t.secondary }]}>{subtitle}</Text>
      </View>
    </View>
  );
}

function ToolRow({ icon, title, subtitle, t, onPress }: { icon: string; title: string; subtitle: string; t: ReturnType<typeof useTheme>; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toolRow, { borderColor: t.border }]}>
      <View style={styles.toolIcon}><TablerIcon name={icon} size={19} color={t.red} /></View>
      <View style={styles.toolText}><Text style={[styles.toolTitle, { color: t.ink }]}>{title}</Text><Text style={[styles.toolSubtitle, { color: t.secondary }]}>{subtitle}</Text></View>
      <TablerIcon name="chevron-right" size={17} color={t.secondary} />
    </Pressable>
  );
}

const MODES: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
  { mode: 'system', label: 'System', icon: 'monitor' },
];

function AppearanceRow({ themeMode, setThemeMode, t }: { themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void; t: ReturnType<typeof useTheme> }) {
  return (
    <View style={[styles.toolRow, styles.appearanceRow, { borderColor: t.border }]}>
      <View style={styles.toolIcon}><TablerIcon name="sun" size={19} color={t.red} /></View>
      <Text style={[styles.toolTitle, { color: t.ink }]}>Appearance</Text>
      <View style={[styles.segTrack, { backgroundColor: t.bg2 }]}>
        {MODES.map(({ mode, label, icon }) => {
          const active = themeMode === mode;
          return (
            <Pressable key={mode} onPress={() => setThemeMode(mode)} style={[styles.segBtn, active && { backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]}>
              <TablerIcon name={icon} size={14} color={active ? t.red : t.secondary} />
              <Text style={[styles.segText, { color: active ? t.red : t.secondary, fontWeight: active ? '700' : '500' }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 },
  title: { fontSize: 25, fontWeight: '700', marginBottom: 14 },
  profile: { minHeight: 84, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, gap: 13 },
  avatar: { height: 48, width: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 17, fontWeight: '700' },
  profileText: { flex: 1 },
  name: { fontSize: 15, fontWeight: '600' },
  email: { fontSize: 12, marginTop: 4 },
  sectionLabel: { fontSize: 10, letterSpacing: 0.5, fontWeight: '700', marginTop: 24, marginBottom: 8 },
  accountLabel: { marginTop: 25 },
  toolRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1 },
  toolIcon: { width: 34, alignItems: 'center' },
  toolText: { flex: 1 },
  toolTitle: { fontSize: 13, fontWeight: '600' },
  toolSubtitle: { fontSize: 11, marginTop: 3 },
  appearanceRow: { minHeight: 56, flexWrap: 'nowrap' },
  segTrack: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2, marginLeft: 'auto' },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8 },
  segText: { fontSize: 11 },
  version: { textAlign: 'center', marginTop: 20, fontSize: 11 },
});
