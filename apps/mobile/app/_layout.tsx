import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { PortalPermissionsProvider } from '../src/auth/PortalPermissionsProvider';
import { theme } from '../src/theme';

function NavigationRoot() {
  const { user, loading, sessionRestoreFailed } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const publicRoute = segments[0] === 'index' || segments[0] === 'login';
    if (!user && sessionRestoreFailed && segments[0] !== 'login') { router.replace('/login'); return; }
    if (!user && !publicRoute) router.replace('/');
    if (user && publicRoute) router.replace('/map');
  }, [loading, user, sessionRestoreFailed, segments, router]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.surface }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="vehicle/[imei]" />
        <Stack.Screen name="vehicle/[imei]/history" />
        <Stack.Screen name="vehicle/[imei]/replay" />
        <Stack.Screen name="vehicle/[imei]/alerts" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <AuthProvider><PortalPermissionsProvider><NavigationRoot /></PortalPermissionsProvider></AuthProvider>;
}
