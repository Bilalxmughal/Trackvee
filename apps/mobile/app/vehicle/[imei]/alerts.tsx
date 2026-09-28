import { useEffect } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { VehicleAlertsPanel } from '../../../src/components/VehicleAlertsPanel';
import { usePortalPermissions } from '../../../src/auth/PortalPermissionsProvider';
import { ActivityIndicator, View } from 'react-native';
import { theme } from '../../../src/theme';

export default function VehicleAlertsRoute() {
  const { imei } = useLocalSearchParams<{ imei: string }>();
  const { canDo, loading } = usePortalPermissions();
  useEffect(() => { if (!loading && !canDo('alerts')) router.back(); }, [canDo, loading]);
  if (loading || !canDo('alerts')) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}><ActivityIndicator color={theme.red}/></View>;
  return <VehicleAlertsPanel visible fullScreen imei={imei} onClose={() => router.back()} />;
}
