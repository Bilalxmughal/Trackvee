import { useMemo, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../../src/lib/api';
import { TablerIcon } from '../../src/components/TablerIcon';
import { useTheme } from '../../src/hooks/useTheme';
import type { AppTheme } from '../../src/theme';

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
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
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
  const reportedVehicle = event?.vehicle?.licensePlate || event?.vehicle?.name;
  const vehicleName = reportedVehicle && !/^\d{14,16}$/.test(reportedVehicle.trim()) ? reportedVehicle : 'Vehicle';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}><Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}><TablerIcon name="back" size={20} color={t.ink} /></Pressable><Text style={styles.headerTitle}>Alert details</Text><View style={styles.back} /></View>
      {loading ? <ActivityIndicator style={{ marginTop: 48 }} color={t.red} /> : error ? <View style={styles.center}><TablerIcon name="alert-triangle" size={28} color={t.red} /><Text style={styles.error}>{error}</Text><Pressable onPress={() => router.replace('/alerts')}><Text style={styles.link}>Go to Alerts</Text></Pressable></View> : event ? <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.icon}><TablerIcon name="bell" size={24} color={t.red} /></View>
        <Text style={styles.title}>{event.alert.name}</Text>
        <Text style={styles.subtitle}>{event.alert.type.replaceAll('_', ' ')}</Text>
        <View style={styles.section}>
          <Detail label="Vehicle" value={vehicleName} styles={styles} />
          <Detail label="Triggered" value={displayTime(event.triggeredAt)} styles={styles} />
          {payload.event != null && <Detail label="Event" value={String(payload.event).replaceAll('_', ' ')} styles={styles} />}
          {payload.speed != null && <Detail label="Speed" value={`${Number(payload.speed).toFixed(0)} km/h`} styles={styles} />}
          {payload.ignition != null && <Detail label="Ignition" value={payload.ignition === true ? 'On' : payload.ignition === false ? 'Off' : String(payload.ignition)} styles={styles} />}
          {payload.geofenceName != null && <Detail label="Geofence" value={String(payload.geofenceName)} styles={styles} />}
          {payload.score != null && <Detail label="Driver score" value={String(payload.score)} styles={styles} />}
          {hasLocation && <Detail label="Coordinates" value={`${lat.toFixed(5)}, ${lng.toFixed(5)}`} styles={styles} />}
        </View>
        {hasLocation && <Pressable style={styles.mapButton} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`)}><TablerIcon name="map-pin" size={17} color="#fff" /><Text style={styles.mapButtonText}>Open location in Google Maps</Text></Pressable>}
        {event.vehicle && <Pressable style={styles.vehicleButton} onPress={() => router.push(`/vehicle/${encodeURIComponent(event.imei)}` as never)}><Text style={styles.vehicleButtonText}>View vehicle</Text><TablerIcon name="forward" size={16} color={t.red} /></Pressable>}
      </ScrollView> : null}
    </SafeAreaView>
  );
}

function Detail({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: t.bg },
    header: { height: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: t.border },
    back: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { color: t.ink, fontWeight: '700', fontSize: 16 },
    body: { padding: 20 },
    icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: `${t.red}14`, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    title: { color: t.ink, fontSize: 22, fontWeight: '700' },
    subtitle: { color: t.secondary, fontSize: 13, textTransform: 'capitalize', marginTop: 5 },
    section: { marginTop: 22, borderTopWidth: 1, borderColor: t.border },
    detail: { minHeight: 58, borderBottomWidth: 1, borderColor: t.border, justifyContent: 'center', gap: 4 },
    detailLabel: { color: t.secondary, fontSize: 11 },
    detailValue: { color: t.ink, fontSize: 14, fontWeight: '600' },
    mapButton: { marginTop: 20, minHeight: 46, borderRadius: 7, backgroundColor: t.red, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
    mapButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    vehicleButton: { minHeight: 48, borderBottomWidth: 1, borderColor: t.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    vehicleButtonText: { color: t.red, fontWeight: '600', fontSize: 13 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
    error: { color: t.ink, fontSize: 14, textAlign: 'center', marginTop: 14 },
    link: { color: t.red, fontSize: 13, fontWeight: '600', marginTop: 18 },
  });
}
