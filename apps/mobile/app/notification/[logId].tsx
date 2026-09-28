import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../src/lib/api';
import { TablerIcon } from '../../src/components/TablerIcon';
import { theme } from '../../src/theme';

type AlertEvent = {
  id: string;
  alert: { id: string; name: string; type: string };
  vehicle: { id: string; name: string; licensePlate: string | null; make: string | null; model: string | null } | null;
  imei: string;
  triggeredAt: string;
  payload: Record<string, unknown>;
};

function displayTime(value: string): string {
  return new Intl.DateTimeFormat('en-PK', { dateStyle: 'medium', timeStyle: 'medium', timeZone: 'Asia/Karachi' }).format(new Date(value));
}

export default function NotificationEventScreen() {
  const { logId } = useLocalSearchParams<{ logId: string }>();
  const [event, setEvent] = useState<AlertEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!logId || Array.isArray(logId)) { setError('This alert event could not be opened.'); setLoading(false); return; }
    void api.get<AlertEvent>(`/alerts/logs/${encodeURIComponent(logId)}`)
      .then(response => { if (active) setEvent(response.data); })
      .catch(() => { if (active) setError('This alert event is unavailable or you do not have access.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [logId]);

  const payload = event?.payload ?? {};
  const lat = Number(payload.lat ?? payload.latitude);
  const lng = Number(payload.lng ?? payload.longitude);
  const hasLocation = Number.isFinite(lat) && Number.isFinite(lng);
  const vehicleName = event?.vehicle?.licensePlate || event?.vehicle?.name || event?.imei || 'Vehicle';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}><TablerIcon name="back" size={20} color={theme.ink} /></Pressable><Text style={styles.headerTitle}>Alert details</Text><View style={styles.back} /></View>
      {loading ? <ActivityIndicator style={{ marginTop: 48 }} color={theme.red} /> : error ? <View style={styles.center}><TablerIcon name="alert-triangle" size={28} color={theme.red} /><Text style={styles.error}>{error}</Text><Pressable onPress={() => router.replace('/alerts')}><Text style={styles.link}>Go to Alerts</Text></Pressable></View> : event ? <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.icon}><TablerIcon name="bell" size={24} color={theme.red} /></View>
        <Text style={styles.title}>{event.alert.name}</Text>
        <Text style={styles.subtitle}>{event.alert.type.replaceAll('_', ' ')}</Text>
        <View style={styles.section}>
          <Detail label="Vehicle" value={vehicleName} />
          <Detail label="Triggered" value={displayTime(event.triggeredAt)} />
          {payload.event != null && <Detail label="Event" value={String(payload.event).replaceAll('_', ' ')} />}
          {payload.speed != null && <Detail label="Speed" value={`${Number(payload.speed).toFixed(0)} km/h`} />}
          {payload.ignition != null && <Detail label="Ignition" value={payload.ignition === true ? 'On' : payload.ignition === false ? 'Off' : String(payload.ignition)} />}
          {payload.geofenceName != null && <Detail label="Geofence" value={String(payload.geofenceName)} />}
          {payload.score != null && <Detail label="Driver score" value={String(payload.score)} />}
          {hasLocation && <Detail label="Coordinates" value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`} />}
        </View>
        {hasLocation && <Pressable style={styles.mapButton} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)}><TablerIcon name="map-pin" size={17} color="#fff" /><Text style={styles.mapButtonText}>Open location in Google Maps</Text></Pressable>}
        {event.vehicle && <Pressable style={styles.vehicleButton} onPress={() => router.push(`/vehicle/${encodeURIComponent(event.imei)}` as never)}><Text style={styles.vehicleButtonText}>View vehicle</Text><TablerIcon name="forward" size={16} color={theme.red} /></Pressable>}
      </ScrollView> : null}
    </SafeAreaView>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { height: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: theme.border },
  back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: theme.ink, fontWeight: '700', fontSize: 16 },
  body: { padding: 20 },
  icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff5f5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { color: theme.ink, fontSize: 22, fontWeight: '700' },
  subtitle: { color: theme.secondary, fontSize: 13, textTransform: 'capitalize', marginTop: 5 },
  section: { marginTop: 22, borderTopWidth: 1, borderColor: theme.border },
  detail: { minHeight: 58, borderBottomWidth: 1, borderColor: theme.border, justifyContent: 'center', gap: 4 },
  detailLabel: { color: theme.secondary, fontSize: 11 },
  detailValue: { color: theme.ink, fontSize: 14, fontWeight: '600' },
  mapButton: { marginTop: 20, minHeight: 46, borderRadius: 7, backgroundColor: theme.red, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  mapButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  vehicleButton: { minHeight: 48, borderBottomWidth: 1, borderColor: theme.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  vehicleButtonText: { color: theme.red, fontWeight: '600', fontSize: 13 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  error: { color: theme.ink, fontSize: 14, textAlign: 'center', marginTop: 14 },
  link: { color: theme.red, fontSize: 13, fontWeight: '600', marginTop: 18 },
});
