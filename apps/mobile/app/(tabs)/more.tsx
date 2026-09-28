import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../src/auth/AuthProvider';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const { canDo } = usePortalPermissions();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';
  const signOut = () => Alert.alert('Sign out', 'Are you sure you want to sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => { void logout(); } }]);
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.title}>More</Text>
      <View style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? 'U'}</Text></View>
        <View style={styles.profileText}><Text style={styles.name}>{name}</Text><Text style={styles.email}>{user?.organizationName || user?.email}</Text></View>
      </View>
      {(canDo('geofences') || canDo('pois') || canDo('driver-behavior') || canDo('users')) ? <>
        <Text style={[styles.sectionLabel, styles.accountLabel]}>FLEET TOOLS</Text>
        {canDo('driver-behavior') ? <Pressable onPress={() => router.push('/behavior')} style={styles.toolRow}><View style={styles.toolIcon}><TablerIcon name="activity" size={19} color={theme.red}/></View><View style={styles.toolText}><Text style={styles.toolTitle}>Driver Behavior</Text><Text style={styles.toolSubtitle}>Safety scores, events and settings</Text></View><TablerIcon name="forward" size={17} color={theme.muted}/></Pressable> : null}
        {canDo('geofences') ? <Pressable onPress={() => router.push('/geofences')} style={styles.toolRow}><View style={styles.toolIcon}><TablerIcon name="geofence" size={19} color={theme.red}/></View><View style={styles.toolText}><Text style={styles.toolTitle}>Geofences</Text><Text style={styles.toolSubtitle}>Manage circle and polygon zones</Text></View><TablerIcon name="forward" size={17} color={theme.muted}/></Pressable> : null}
        {canDo('pois') ? <Pressable onPress={() => router.push('/pois')} style={styles.toolRow}><View style={styles.toolIcon}><TablerIcon name="map-pin" size={19} color={theme.red}/></View><View style={styles.toolText}><Text style={styles.toolTitle}>Points of Interest</Text><Text style={styles.toolSubtitle}>Manage saved locations</Text></View><TablerIcon name="forward" size={17} color={theme.muted}/></Pressable> : null}
        {canDo('users') ? <Pressable onPress={() => router.push('/users')} style={styles.toolRow}><View style={styles.toolIcon}><TablerIcon name="user" size={19} color={theme.red}/></View><View style={styles.toolText}><Text style={styles.toolTitle}>Users</Text><Text style={styles.toolSubtitle}>Manage accounts and access</Text></View><TablerIcon name="forward" size={17} color={theme.muted}/></Pressable> : null}
      </> : null}
      <Text style={[styles.sectionLabel, styles.accountLabel]}>ACCOUNT</Text>
      <View style={styles.infoRow}><Text style={styles.infoLabel}>Organization</Text><Text style={styles.infoValue} numberOfLines={1}>{user?.organizationName || '—'}</Text></View>
      <View style={styles.infoRow}><Text style={styles.infoLabel}>Account role</Text><Text style={styles.infoValue}>{user?.role.replace('client_', '').replaceAll('_', ' ') || '—'}</Text></View>
      <Pressable onPress={signOut} style={styles.signOut}><TablerIcon name="logout" size={18} color={theme.red} /><Text style={styles.signOutText}>Sign out</Text></Pressable>
      <Text style={styles.version}>Trackvee Mobile · Expo SDK 57</Text>
    </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, content: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32 }, title: { fontSize: 25, color: theme.ink, fontWeight: '700', marginBottom: 18 }, profile: { minHeight: 84, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderTopWidth: 1, borderColor: theme.border, gap: 13 }, avatar: { height: 48, width: 48, borderRadius: 24, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: theme.ink, fontSize: 17, fontWeight: '700' }, profileText: { flex: 1 }, name: { color: theme.ink, fontSize: 15, fontWeight: '600' }, email: { color: theme.secondary, fontSize: 12, marginTop: 4 }, sectionLabel: { color: theme.secondary, fontSize: 10, letterSpacing: 0.5, fontWeight: '700', marginTop: 24, marginBottom: 8 }, accountLabel: { marginTop: 25 }, toolRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderColor: theme.border }, toolIcon: { width: 34, alignItems: 'center' }, toolText: { flex: 1 }, toolTitle: { color: theme.ink, fontSize: 13, fontWeight: '600' }, toolSubtitle: { color: theme.secondary, fontSize: 11, marginTop: 3 }, infoRow: { minHeight: 43, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.border }, infoLabel: { fontSize: 13, color: theme.secondary }, infoValue: { maxWidth: '60%', fontSize: 13, color: theme.ink, textTransform: 'capitalize' }, signOut: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, signOutText: { color: theme.red, fontSize: 14, fontWeight: '600' }, version: { color: theme.muted, textAlign: 'center', marginTop: 20, fontSize: 11 } });
