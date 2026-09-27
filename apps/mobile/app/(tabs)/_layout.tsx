import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TablerIcon } from '../../src/components/TablerIcon';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { theme } from '../../src/theme';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { canDo } = usePortalPermissions();
  const icon = (name: string) => ({ color, focused }: { color: ColorValue; focused: boolean; size: number }) => <TablerIcon name={name} size={22} color={focused ? theme.red : String(color)} />;
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: theme.red,
      tabBarInactiveTintColor: theme.secondary,
      tabBarStyle: { height: 56 + insets.bottom, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 5), borderTopColor: theme.border, backgroundColor: '#fff', elevation: 0 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '500', marginBottom: 0 },
    }}>
      <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: icon('map') }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles', tabBarIcon: icon('truck'), href: canDo('vehicles') ? '/vehicles' : null }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', tabBarIcon: icon('bell'), href: canDo('alerts') ? '/alerts' : null }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', tabBarIcon: icon('report'), href: canDo('reports') ? '/reports' : null }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: icon('more') }} />
    </Tabs>
  );
}
