import { useEffect, useRef, useState } from 'react';
import { Animated, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import { PortalPermissionsProvider } from '../src/auth/PortalPermissionsProvider';
import { ThemeProvider, useThemeContext } from '../src/contexts/ThemeContext';
import { getAlertSoundEnabled, getPushTokenListener } from '../src/lib/pushNotifications';
import { OfflineBanner } from '../src/components/OfflineBanner';
import api from '../src/lib/api';

Notifications.setNotificationHandler({
  handleNotification: async notification => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: (await getAlertSoundEnabled().catch(() => true)) && notification.request.content.sound !== null,
    shouldSetBadge: false,
  }),
});

// ── Launch Screen ─────────────────────────────────────────────────────────────
function LaunchScreen({ imageUrl, duration, onDone }: { imageUrl: string; duration: number; onDone: () => void }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [countdown, setCountdown] = useState(duration);

  useEffect(() => {
    const interval = setInterval(() => setCountdown(c => c - 1), 1000);
    const timer = setTimeout(() => {
      clearInterval(interval);
      Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }).start(onDone);
    }, duration * 1000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [duration, onDone, opacity]);

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[ls.container, { opacity }]}>
        <Image source={{ uri: imageUrl }} style={ls.image} resizeMode="cover" />
        <View style={ls.bottomBar}>
          <Pressable onPress={() => {
            Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(onDone);
          }} style={ls.skipBtn}>
            <Text style={ls.skipText}>Skip  {countdown > 0 ? countdown : ''}</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const ls = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  bottomBar: { position: 'absolute', bottom: 60, left: 0, right: 0, alignItems: 'center' },
  skipBtn: { backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 24 },
  skipText: { color: '#fff', fontSize: 14, fontWeight: '600', letterSpacing: 0.3 },
});

// ── Navigation root ───────────────────────────────────────────────────────────
function NavigationRoot() {
  const { user, loading, sessionRestoreFailed } = useAuth();
  const [launchConfig, setLaunchConfig] = useState<{ imageUrl: string; duration: number } | null>(null);
  const [launchDone, setLaunchDone] = useState(false);
  const launchFetched = useRef(false);

  // Fetch launch config once user is logged in
  useEffect(() => {
    if (!user || launchFetched.current) return;
    launchFetched.current = true;
    api.get<{ imageUrl?: string; duration?: number }>('/site-settings/app-launch')
      .then(r => {
        if (r.data?.imageUrl && r.data?.duration) {
          const raw = r.data.imageUrl;
          const apiBase = (api.defaults.baseURL ?? '').replace(/\/api\/v1$/, '');
          const fullUrl = raw.startsWith('http') ? raw : `${apiBase}${raw}`;
          setLaunchConfig({ imageUrl: fullUrl, duration: r.data.duration });
        }
      })
      .catch(() => {});
  }, [user]);
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
      <OfflineBanner />
      {launchConfig && !launchDone && (
        <LaunchScreen imageUrl={launchConfig.imageUrl} duration={launchConfig.duration} onDone={() => setLaunchDone(true)} />
      )}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: t.surface }, animation: 'fade' }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="login" />
        <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="alert-rule" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="users" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="vehicle/[imei]" />
        <Stack.Screen name="vehicle/[imei]/history" />
        <Stack.Screen name="vehicle/[imei]/replay" />
        <Stack.Screen name="vehicle/[imei]/alerts" />
        <Stack.Screen name="notification/[logId]" />
        <Stack.Screen name="device-health" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="settings" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="behavior" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="geofences" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
        <Stack.Screen name="pois" options={{ animation: 'default', animationMatchesGesture: true, gestureEnabled: true, fullScreenGestureEnabled: true }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <ThemeProvider><AuthProvider><PortalPermissionsProvider><NavigationRoot /></PortalPermissionsProvider></AuthProvider></ThemeProvider>;
}
