import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '../../src/auth/AuthProvider';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';

export default function MoreScreen() {
  const { user, logout } = useAuth();
  const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';
  const signOut = () => Alert.alert('Sign out', 'Are you sure you want to sign out?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: () => { void logout(); } }]);
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>More</Text>
      <View style={styles.profile}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{name[0]?.toUpperCase() ?? 'U'}</Text></View>
        <View style={styles.profileText}><Text style={styles.name}>{name}</Text><Text style={styles.email}>{user?.organizationName || user?.email}</Text></View>
      </View>
      <Text style={[styles.sectionLabel, styles.accountLabel]}>ACCOUNT</Text>
      <View style={styles.infoRow}><Text style={styles.infoLabel}>Organization</Text><Text style={styles.infoValue} numberOfLines={1}>{user?.organizationName || '—'}</Text></View>
      <View style={styles.infoRow}><Text style={styles.infoLabel}>Account role</Text><Text style={styles.infoValue}>{user?.role.replace('client_', '').replaceAll('_', ' ') || '—'}</Text></View>
      <Pressable onPress={signOut} style={styles.signOut}><TablerIcon name="logout" size={18} color={theme.red} /><Text style={styles.signOutText}>Sign out</Text></Pressable>
      <Text style={styles.version}>Trackvee Mobile · Expo SDK 57</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ container: { flex: 1, backgroundColor: '#fff' }, content: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32 }, title: { fontSize: 25, color: theme.ink, fontWeight: '700', marginBottom: 18 }, profile: { minHeight: 84, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderTopWidth: 1, borderColor: theme.border, gap: 13 }, avatar: { height: 48, width: 48, borderRadius: 24, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center' }, avatarText: { color: theme.ink, fontSize: 17, fontWeight: '700' }, profileText: { flex: 1 }, name: { color: theme.ink, fontSize: 15, fontWeight: '600' }, email: { color: theme.secondary, fontSize: 12, marginTop: 4 }, sectionLabel: { color: theme.secondary, fontSize: 10, letterSpacing: 0.5, fontWeight: '700', marginTop: 24, marginBottom: 8 }, accountLabel: { marginTop: 25 }, infoRow: { minHeight: 43, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: theme.border }, infoLabel: { fontSize: 13, color: theme.secondary }, infoValue: { maxWidth: '60%', fontSize: 13, color: theme.ink, textTransform: 'capitalize' }, signOut: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 18 }, signOutText: { color: theme.red, fontSize: 14, fontWeight: '600' }, version: { color: theme.muted, textAlign: 'center', marginTop: 20, fontSize: 11 } });
