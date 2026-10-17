import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { ActivityIndicator, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TablerIcon } from '../../src/components/TablerIcon';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { useTheme } from '../../src/hooks/useTheme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const { canDo, loading } = usePortalPermissions();
  const icon = (name: string) => ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => <TablerIcon name={name} size={22} color={focused ? t.red : String(color)} />;
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.red} /></View>;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: t.red,
      tabBarInactiveTintColor: t.secondary,
      tabBarStyle: { height: 56 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 5), borderTopColor: t.border, backgroundColor: t.bg, elevation: 0 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginBottom: 0 },
    }}>
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon('map') }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles', tabBarIcon: icon('truck'), href: canDo('vehicles') ? '/vehicles' : null }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: icon('bell'), href: canDo('alerts') ? '/alerts' : null }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: icon('report'), href: canDo('reports') ? '/reports' : null }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('more') }} />
      <Tabs.Screen name="geofences" options={{ href: null }} />
      <Tabs.Screen name="pois" options={{ href: null }} />
      <Tabs.Screen name="behavior" options={{ href: null }} />
    </Tabs>
  );
}
