import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { PortalPermissionsProvider } from '../src/auth/PortalPermissionsProvider';
import { ThemeProvider, useThemeContext } from '../src/contexts/ThemeContext';
import { theme } from '../src/theme';
import { getAlertSoundEnabled, getPushTokenListener } from '../src/lib/pushNotifications';

Notifications.setNotificationHandler({
  handleNotification: async notification => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: (await getAlertSoundEnabled().catch(() => true)) && notification.request.content.sound !== null,
    shouldSetBadge: false,
  }),
});

function NavigationRoot() {
  const { user, loading, sessionRestoreFailed } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pendingNotificationPath = useRef<string | null>(null);
  const lastHandledNotification = useRef<{ id: string; at: number } | null>(null);

  useEffect(() => {
    const navigateToNotification = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as { path?: unknown; logId?: unknown };
      const path = typeof data.path === 'string' ? data.path : typeof data.logId === 'string' ? `/notification/${data.logId}` : null;
      if (!path || !/^\/notification\/[0-9a-f-]{36}$/i.test(path)) return;
      const responseId = response.notification.request.identifier;
      const now = Date.now();
      if (lastHandledNotification.current?.id === responseId && now - lastHandledNotification.current.at < 2000) return;
      lastHandledNotification.current = { id: responseId, at: now };
      if (user) router.push(path as never);
      else pendingNotificationPath.current = path;
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(navigateToNotification);
    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) navigateToNotification(lastResponse);
    return () => subscription.remove();
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    const subscription = getPushTokenListener();
    return () => subscription.remove();
  }, [user?.id]);

  useEffect(() => {
    if (!user || !pendingNotificationPath.current) return;
    const path = pendingNotificationPath.current;
    pendingNotificationPath.current = null;
    router.push(path as never);
  }, [user, router]);

  useEffect(() => {
    if (loading) return;
    const publicRoute = segments[0] === 'index' || segments[0] === 'login';
    if (!user && sessionRestoreFailed && segments[0] !== 'login') { router.replace('/login'); return; }
    if (!user && !publicRoute) router.replace('/');
    if (user && publicRoute) {
      router.replace('/map');
    }
  }, [loading, user, sessionRestoreFailed, segments, router]);

  const { isDark, theme: t } = useThemeContext();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.surface }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="alert-rule" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="users" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="vehicle/[imei]" />
        <Stack.Screen name="vehicle/[imei]/history" />
        <Stack.Screen name="vehicle/[imei]/replay" />
        <Stack.Screen name="vehicle/[imei]/alerts" />
        <Stack.Screen name="notification/[logId]" />
        <Stack.Screen name="device-health" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="settings" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <ThemeProvider><AuthProvider><PortalPermissionsProvider><NavigationRoot /></PortalPermissionsProvider></AuthProvider></ThemeProvider>;
}
