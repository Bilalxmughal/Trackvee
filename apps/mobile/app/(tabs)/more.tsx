import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRef, useState } from 'react';
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
  const initial = name[0]?.toUpperCase() ?? 'U';
  const roleLabel = user?.role.replace('client_', '').replaceAll('_', ' ') || '';
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const slideAnim = useRef(new Animated.Value(80)).current;

  const openSignOut = () => {
    setShowSignOutConfirm(true);
    Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 12 }).start();
  };
  const closeSignOut = () => {
    Animated.timing(slideAnim, { toValue: 80, duration: 200, useNativeDriver: true }).start(() => setShowSignOutConfirm(false));
  };
  const confirmSignOut = () => {
    closeSignOut();
    setTimeout(() => { void logout(); }, 220);
  };

  const hasFleet = canDo('vehicles') || canDo('geofences') || canDo('pois') || canDo('driver-behavior') || canDo('maintenance') || canDo('alerts') || canDo('engine_cut');
  const hasAdmin = canDo('users');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>


        {/* Header */}
        <Text style={[styles.pageTitle, { color: t.ink }]}>More</Text>

        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: t.card, shadowColor: '#000' }]}>
          <View style={[styles.avatar, { backgroundColor: t.red }]}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: t.ink }]} numberOfLines={1}>{name}</Text>
            {!!roleLabel && <Text style={[styles.profileRole, { color: t.secondary }]} numberOfLines={1}>{roleLabel}</Text>}
            <Text style={[styles.profileOrg, { color: t.muted }]} numberOfLines={1}>{user?.organizationName || user?.email || ''}</Text>
          </View>
          <View style={[styles.profileBadge, { backgroundColor: t.bg2 }]}>
            <TablerIcon name="shield" size={14} color={t.red} />
          </View>
        </View>

        {/* Crew Scan */}
        <SectionLabel label="AIRLINES" t={t} />
        <View style={[styles.card, { backgroundColor: t.card, shadowColor: '#000' }]}>
          <Row icon="nfc" iconBg="#dc26260f" iconColor="#dc2626" title="Crew Scan" sub="NFC card scan for crew check-in/out" t={t} onPress={() => router.push('/scan')} last />
        </View>

        {/* Fleet Tools */}
        {hasFleet ? (
          <>
            <SectionLabel label="FLEET TOOLS" t={t} />
            <View style={[styles.card, { backgroundColor: t.card, shadowColor: '#000' }]}>
              {canDo('alerts') && <Row icon="bell" iconBg="#EF44440f" iconColor="#EF4444" title="Alerts" sub="History and notifications" t={t} onPress={() => router.push('/alerts')} />}
              {canDo('vehicles') && <Row icon="cpu" iconBg="#3B82F60f" iconColor="#3B82F6" title="Device Health" sub="Connection, GPS and power status" t={t} onPress={() => router.push('/device-health')} />}
              {canDo('maintenance') && <Row icon="tool" iconBg="#F59E0B0f" iconColor="#F59E0B" title="Maintenance" sub="Service history and reminders" t={t} onPress={() => router.push('/maintenance')} />}
              {canDo('driver-behavior') && <Row icon="activity" iconBg="#10B9810f" iconColor="#10B981" title="Driver Behavior" sub="Safety scores and events" t={t} onPress={() => router.push('/behavior')} />}
              {canDo('geofences') && <Row icon="geofence" iconBg="#8B5CF60f" iconColor="#8B5CF6" title="Geofences" sub="Circle and polygon zones" t={t} onPress={() => router.push('/geofences')} />}
              {canDo('pois') && <Row icon="map-pin" iconBg="#EC48990f" iconColor="#EC4899" title="Points of Interest" sub="Saved locations" t={t} onPress={() => router.push('/pois')} last={!canDo('engine_cut')} />}
              {canDo('engine_cut') && <Row icon="bolt" iconBg="#EF44440f" iconColor="#EF4444" title="Command Center" sub="Engine cut and restore" t={t} onPress={() => router.push('/command-center')} />}
              <Row icon="share" iconBg="#06B6D40f" iconColor="#06B6D4" title="Share Links" sub="Share live vehicle location" t={t} onPress={() => router.push('/share-links')} last />
            </View>
          </>
        ) : null}

        {/* Administration */}
        {hasAdmin ? (
          <>
            <SectionLabel label="ADMINISTRATION" t={t} />
            <View style={[styles.card, { backgroundColor: t.card, shadowColor: '#000' }]}>
              {canDo('users') && <Row icon="users" iconBg="#8B5CF60f" iconColor="#8B5CF6" title="Users" sub="Manage accounts and access" t={t} onPress={() => router.push('/users')} />}
              <Row icon="settings" iconBg="#6B72800f" iconColor="#6B7280" title="Settings" sub="Notifications and preferences" t={t} onPress={() => router.push('/settings')} last />
            </View>
          </>
        ) : (
          <>
            <SectionLabel label="ADMINISTRATION" t={t} />
            <View style={[styles.card, { backgroundColor: t.card, shadowColor: '#000' }]}>
              <Row icon="settings" iconBg="#6B72800f" iconColor="#6B7280" title="Settings" sub="Notifications and preferences" t={t} onPress={() => router.push('/settings')} last />
            </View>
          </>
        )}

        {/* Preferences */}
        <SectionLabel label="PREFERENCES" t={t} />
        <View style={[styles.card, { backgroundColor: t.card, shadowColor: '#000' }]}>
          <AppearanceRow themeMode={themeMode} setThemeMode={setThemeMode} t={t} />
          <Row icon="map-off" iconBg="#10B9810f" iconColor="#10B981" title="Offline Maps" sub="Download tiles for offline use" t={t} onPress={() => router.push('/offline-map')} />
          <Row icon="headset" iconBg="#3B82F60f" iconColor="#3B82F6" title="Support" sub="WhatsApp, phone or email" t={t} onPress={() => router.push('/support')} last />
        </View>

        {/* Account */}
        <SectionLabel label="ACCOUNT" t={t} />
        <View style={[styles.card, { backgroundColor: t.card, shadowColor: '#000' }]}>
          <View style={styles.row}>
            <View style={[styles.iconWrap, { backgroundColor: '#6B72800f' }]}>
              <TablerIcon name="building" size={18} color="#6B7280" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: t.ink }]} numberOfLines={1}>{user?.organizationName || '—'}</Text>
              <Text style={[styles.rowSub, { color: t.secondary }]}>Organization</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: t.border }]} />
          <Pressable onPress={openSignOut} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
            <View style={[styles.iconWrap, { backgroundColor: '#EF44440f' }]}>
              <TablerIcon name="logout" size={18} color="#EF4444" />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: '#EF4444' }]}>Sign out</Text>
              <Text style={[styles.rowSub, { color: t.secondary }]}>End your current session</Text>
            </View>
          </Pressable>
        </View>

        <Text style={[styles.version, { color: t.muted }]}>Trackvee Mobile · Expo SDK 57</Text>
      </ScrollView>

      {/* Sign out bottom confirmation */}
      {showSignOutConfirm && (
        <Pressable style={styles.overlay} onPress={closeSignOut}>
          <Animated.View style={[styles.signOutSheet, { backgroundColor: t.card, transform: [{ translateY: slideAnim }] }]}>
            <View style={[styles.sheetHandle, { backgroundColor: t.border }]} />
            <View style={[styles.sheetIconWrap, { backgroundColor: '#EF44440f' }]}>
              <TablerIcon name="logout" size={22} color="#EF4444" />
            </View>
            <Text style={[styles.sheetTitle, { color: t.ink }]}>Sign out?</Text>
            <Text style={[styles.sheetSub, { color: t.secondary }]}>You will need to sign in again to access your fleet.</Text>
            <Pressable onPress={confirmSignOut} style={styles.sheetConfirmBtn}>
              <Text style={styles.sheetConfirmText}>Sign out</Text>
            </Pressable>
            <Pressable onPress={closeSignOut} style={[styles.sheetCancelBtn, { backgroundColor: t.bg2 }]}>
              <Text style={[styles.sheetCancelText, { color: t.ink }]}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

function SectionLabel({ label, t }: { label: string; t: ReturnType<typeof useTheme> }) {
  return <Text style={[styles.sectionLabel, { color: t.secondary }]}>{label}</Text>;
}

function Row({
  icon, iconBg, iconColor, title, sub, t, onPress, last,
}: {
  icon: string; iconBg: string; iconColor: string; title: string; sub: string;
  t: ReturnType<typeof useTheme>; onPress: () => void; last?: boolean;
}) {
  return (
    <>
      <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <TablerIcon name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color: t.ink }]}>{title}</Text>
          <Text style={[styles.rowSub, { color: t.secondary }]}>{sub}</Text>
        </View>
        <TablerIcon name="chevron-right" size={16} color={t.muted} />
      </Pressable>
      {!last && <View style={[styles.divider, { backgroundColor: t.border }]} />}
    </>
  );
}

const MODES: { mode: ThemeMode; label: string; icon: string }[] = [
  { mode: 'light', label: 'Light', icon: 'sun' },
  { mode: 'dark', label: 'Dark', icon: 'moon' },
  { mode: 'system', label: 'System', icon: 'monitor' },
];

function AppearanceRow({ themeMode, setThemeMode, t }: { themeMode: ThemeMode; setThemeMode: (m: ThemeMode) => void; t: ReturnType<typeof useTheme> }) {
  return (
    <>
      <View style={styles.row}>
        <View style={[styles.iconWrap, { backgroundColor: '#F59E0B0f' }]}>
          <TablerIcon name="sun" size={18} color="#F59E0B" />
        </View>
        <Text style={[styles.rowTitle, { color: t.ink, flex: 1 }]}>Appearance</Text>
        <View style={[styles.segTrack, { backgroundColor: t.bg2 }]}>
          {MODES.map(({ mode, label, icon }) => {
            const active = themeMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setThemeMode(mode)}
                style={[styles.segBtn, active && { backgroundColor: t.card, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 }]}
              >
                <TablerIcon name={icon} size={13} color={active ? t.red : t.secondary} />
                <Text style={[styles.segText, { color: active ? t.red : t.secondary, fontWeight: active ? '700' : '500' }]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: t.border }]} />
    </>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },

  pageTitle: { fontSize: 26, fontWeight: '800', marginBottom: 16, letterSpacing: -0.5 },

  profileCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16, padding: 16, gap: 14,
    marginBottom: 8,
    shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 20, fontWeight: '800', color: '#fff' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 15, fontWeight: '700' },
  profileRole: { fontSize: 11, marginTop: 2, textTransform: 'capitalize' },
  profileOrg: { fontSize: 11, marginTop: 1 },
  profileBadge: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, paddingHorizontal: 4 },

  card: {
    borderRadius: 16, overflow: 'hidden',
    shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 13 },
  iconWrap: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14, fontWeight: '600' },
  rowSub: { fontSize: 11.5, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 67 },

  segTrack: { flexDirection: 'row', borderRadius: 10, padding: 3, gap: 2 },
  segBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  segText: { fontSize: 10.5 },

  version: { textAlign: 'center', marginTop: 24, fontSize: 11 },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  signOutSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: 20 },
  sheetIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  sheetTitle: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  sheetSub: { fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 24 },
  sheetConfirmBtn: { width: '100%', backgroundColor: '#EF4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  sheetConfirmText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  sheetCancelBtn: { width: '100%', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  sheetCancelText: { fontSize: 15, fontWeight: '600' },
});
