import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import api from '../src/lib/api';
import { FleetAlertForm, type AlertVehicle, type AlertVehicleGroup, type AlertZone, type FleetAlertRule } from '../src/components/FleetAlertForm';
import { TablerIcon } from '../src/components/TablerIcon';
import { useAuth } from '../src/auth/AuthProvider';
import { usePortalPermissions } from '../src/auth/PortalPermissionsProvider';
import { useTheme } from '../src/contexts/ThemeContext';
import type { AppTheme } from '../src/theme';

interface Device { imei: string; vehicle: { id: string; name: string; licensePlate: string | null; make?: string | null; model?: string | null } | null; }
interface OrgPerm { vehicleIds?: string[] | null; }
interface FormData { initial: FleetAlertRule | null; vehicles: AlertVehicle[]; groups: AlertVehicleGroup[]; geofences: AlertZone[]; allowFleetWide: boolean; }

export default function AlertRuleScreen() {
  const params = useLocalSearchParams<{ ruleId?: string | string[] }>();
  const ruleId = useMemo(() => Array.isArray(params.ruleId) ? params.ruleId[0] : params.ruleId, [params.ruleId]);
  const { user } = useAuth();
  const { canDo, loading: permissionsLoading } = usePortalPermissions();
  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const action = ruleId ? 'edit' : 'add';

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canDo('alerts', action)) {
      router.back();
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const [ruleResult, deviceResult, groupResult, geofenceResult, permissionResult] = await Promise.all([
          ruleId ? api.get<FleetAlertRule[]>('/alerts') : Promise.resolve({ data: [] as FleetAlertRule[] }),
          api.get<Device[]>('/devices').catch(() => ({ data: [] as Device[] })),
          api.get<AlertVehicleGroup[]>('/vehicle-groups').catch(() => ({ data: [] as AlertVehicleGroup[] })),
          api.get<AlertZone[]>('/geofences').catch(() => ({ data: [] as AlertZone[] })),
          user && !['client_owner', 'client_super_admin'].includes(user.role)
            ? api.get<OrgPerm | null>(`/org-permissions/${user.id}`).then(result => ({ data: result.data, failed: false })).catch(() => ({ data: null, failed: true }))
            : Promise.resolve({ data: null, failed: false }),
        ]);
        const initial = ruleId ? ruleResult.data.find(rule => rule.id === ruleId) ?? null : null;
        if (ruleId && (!initial || initial.canEdit !== true)) {
          if (active) setError('This alert rule is unavailable or cannot be edited with your access.');
          return;
        }
        const vehicles = deviceResult.data.flatMap(device => device.vehicle ? [{
          id: device.vehicle.id,
          imei: device.imei,
          plate: device.vehicle.licensePlate || device.vehicle.name,
          name: [device.vehicle.make, device.vehicle.model].filter(Boolean).join(' ') || device.vehicle.name,
        }] : []);
        const orgPerm = permissionResult.data;
        const allowFleetWide = ['client_owner', 'client_super_admin'].includes(user?.role ?? '')
          || (!permissionResult.failed && orgPerm?.vehicleIds == null);
        if (active) setFormData({ initial, vehicles, groups: groupResult.data ?? [], geofences: geofenceResult.data ?? [], allowFleetWide });
      } catch {
        if (active) setError('Alert form could not be loaded. Check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [action, canDo, permissionsLoading, ruleId, user?.id, user?.role]);

  const t = useTheme();
  const s = useMemo(() => createStyles(t), [t]);

  if (loading || permissionsLoading) return <SafeAreaView style={s.center} edges={['top', 'bottom']}><ActivityIndicator color={t.red}/><Text style={s.status}>Loading alert form…</Text></SafeAreaView>;
  if (error || !formData) return <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
    <View style={s.header}><Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to alerts"><TablerIcon name="back" size={21} color={t.ink}/></Pressable><Text style={s.title}>Alert Rule</Text><View style={s.backSlot}/></View>
    <View style={s.center}><Text style={s.error}>{error || 'Alert form is unavailable.'}</Text><Pressable onPress={() => router.back()} style={s.backButton}><Text style={s.backText}>Back to alerts</Text></Pressable></View>
  </SafeAreaView>;

  return <FleetAlertForm
    initial={formData.initial}
    vehicles={formData.vehicles}
    groups={formData.groups}
    geofences={formData.geofences}
    allowFleetWide={formData.allowFleetWide}
    onClose={() => router.back()}
    onSaved={() => router.back()}
  />;
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  screen: { flex: 1, backgroundColor: t.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, padding: 24 },
  status: { color: t.secondary, fontSize: 12, marginTop: 10 },
  header: { minHeight: 54, paddingHorizontal: 18, borderBottomWidth: 1, borderColor: t.border, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: t.ink, fontSize: 16, fontWeight: '700' },
  backSlot: { width: 22 },
  error: { color: t.secondary, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  backButton: { minHeight: 42, marginTop: 18, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  backText: { color: t.red, fontSize: 13, fontWeight: '700' },
}); }
