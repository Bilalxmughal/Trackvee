import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Image, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View, BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import axios from 'axios';
import { API_BASE } from '../src/lib/api';
import * as SecureStore from 'expo-secure-store';
import { TablerIcon } from '../src/components/TablerIcon';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';
import logo from '../assets/trackvee-logo.png';

async function getScannerLocation() {
  const Location = await import('expo-location');
  const permission = await Location.getForegroundPermissionsAsync();
  const access = !permission.granted && permission.canAskAgain
    ? await Location.requestForegroundPermissionsAsync()
    : permission;
  if (!access.granted) return undefined;

  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const fix = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<undefined>(resolve => { timeout = setTimeout(resolve, 5_000); }),
    ]);
    if (!fix) return undefined;
    const { latitude, longitude, accuracy } = fix.coords;
    return { latitude, longitude, accuracy, timestamp: fix.timestamp };
  } finally {
    clearTimeout(timeout);
  }
}

// Separate axios instance for vehicle API calls — reads yt_vehicle_token, NOT yt_token
const vehicleApi = axios.create({ baseURL: API_BASE, timeout: 20000 });
vehicleApi.interceptors.request.use(async (config) => {
  const token = config.url === '/airlines/vehicles/login' ? null : await SecureStore.getItemAsync('yt_vehicle_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Clear only the vehicle session that received the authorization failure.
let _onVehicleSessionExpired: (() => void) | null = null;
function setVehicleSessionExpiredHandler(cb: (() => void) | null) { _onVehicleSessionExpired = cb; }

vehicleApi.interceptors.response.use(
  (res) => res,
  async (err) => {
    const rejected = err?.config?.headers?.get('Authorization');
    if (err?.response?.status === 401 && rejected) {
      const current = await SecureStore.getItemAsync('yt_vehicle_token').catch(() => null);
      if (current && rejected === `Bearer ${current}`) {
        await clearSavedVehicleSession();
        _onVehicleSessionExpired?.();
      }
    }
    return Promise.reject(err);
  },
);

async function clearSavedVehicleSession() {
  await Promise.all([
    SecureStore.deleteItemAsync('yt_vehicle_token').catch(() => {}),
    SecureStore.deleteItemAsync('yt_vehicle_data').catch(() => {}),
  ]);
}

// NFC — optional import (only available in custom builds)
let NfcManager: any = null;
let NfcTech: any = null;
try {
  const nfc = require('react-native-nfc-manager');
  NfcManager = nfc.default;
  NfcTech = nfc.NfcTech;
  NfcManager.start().catch(() => {});
} catch {}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionVehicle {
  vehicleId: string; airlineId: string;
  vehicleName: string; licensePlate: string | null;
  airlineName: string; iataCode: string | null;
  logoData?: string | null;
}

interface ActiveCheckin {
  tripId: string; crewName: string;
  designation: string | null; checkinAt: string;
}

interface ScanResult {
  action: 'checkin' | 'checkout';
  crew: { id: string; displayId: number; name: string; designation: string | null };
  tripId?: string;
  checkinAt?: string; checkoutAt?: string;
  checkinStop?: string | null; checkoutStop?: string | null;
  kmTravelled?: number | null;
}

// ─── Pulse animation ──────────────────────────────────────────────────────────

function PulseRing({ color, delay }: { color: string; delay: number }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(scale,   { toValue: 1.8, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0,   duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(scale,   { toValue: 0.6, duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
      ]),
    ]));
    loop.start();
    return () => loop.stop();
  }, [scale, opacity, delay]);
  return (
    <Animated.View style={{
      position: 'absolute', width: 160, height: 160, borderRadius: 80,
      borderWidth: 2, borderColor: color, transform: [{ scale }], opacity,
    }} />
  );
}

// ─── WiFi-style scan icon ─────────────────────────────────────────────────────

function WifiArc({ r, th, color }: { r: number; th: number; color: string }) {
  return (
    <View style={{ width: r * 2, height: r, overflow: 'hidden', position: 'absolute', bottom: th * 1.2 }}>
      <View style={{ width: r * 2, height: r * 2, borderRadius: r, borderWidth: th, borderColor: color }} />
    </View>
  );
}

function WifiScanIcon({ size, color }: { size: number; color: string }) {
  const th = Math.max(2.5, size * 0.055);
  const dot = th * 2.2;
  const radii = [size * 0.19, size * 0.33, size * 0.47];
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: size * 0.06 }}>
      {radii.map((r, i) => <WifiArc key={i} r={r} th={th} color={color} />)}
      <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />
    </View>
  );
}

// ─── Live travel timer ────────────────────────────────────────────────────────

function LiveTimer({ checkinAt }: { checkinAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.floor((Date.now() - new Date(checkinAt).getTime()) / 1000)
  );
  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - new Date(checkinAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [checkinAt]);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return (
    <Text style={{ fontSize: 12, fontWeight: '700' as const, color: '#059669' }}>
      {`${m}m : ${s < 10 ? '0' : ''}${s}s`}
    </Text>
  );
}

// ─── OTP PIN Input ────────────────────────────────────────────────────────────

function PinInput({ value, onChange, theme }: { value: string; onChange: (v: string) => void; theme: AppTheme }) {
  const ref0 = useRef<TextInput>(null);
  const ref1 = useRef<TextInput>(null);
  const ref2 = useRef<TextInput>(null);
  const ref3 = useRef<TextInput>(null);
  const refs = [ref0, ref1, ref2, ref3];
  const [focused, setFocused] = useState(-1);
  const digits = value.split('').concat(['', '', '', '']).slice(0, 4);

  const handleChange = (index: number, text: string) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const arr = digits.map((d, i) => (i === index ? digit : d));
    onChange(arr.join(''));
    if (digit && index < 3) refs[index + 1].current?.focus();
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const arr = digits.map((d, i) => (i === index - 1 ? '' : d));
      onChange(arr.join(''));
      refs[index - 1].current?.focus();
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 8 }}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={{
            width: 62, height: 60, borderRadius: 7,
            borderWidth: focused === i ? 2 : 1,
            borderColor: focused === i ? '#dc2626' : theme.border,
            fontSize: 26, fontWeight: '700' as const,
            textAlign: 'center', color: theme.ink,
            backgroundColor: theme.inputBg,
          }}
          value={d}
          onChangeText={text => handleChange(i, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
          onFocus={() => setFocused(i)}
          onBlur={() => setFocused(-1)}
          keyboardType="number-pad"
          maxLength={2}
          secureTextEntry
        />
      ))}
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

type ScanState = 'idle' | 'scanning' | 'result' | 'confirming' | 'success';

export default function ScanScreen() {
  const t = useTheme();
  const s = useMemo(() => makeStyles(t), [t]);

  const [sessionVehicle, setSessionVehicle] = useState<SessionVehicle | null>(null);
  const [restoring, setRestoring]     = useState(true); // true while checking stored session
  const [plateInput, setPlateInput]   = useState('');
  const [pinInput, setPinInput]       = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError]   = useState('');

  const [scanState, setScanState]     = useState<ScanState>('idle');
  const [pendingNfc, setPendingNfc]   = useState('');
  const [scanResult, setScanResult]   = useState<ScanResult | null>(null);
  const [scanError, setScanError]     = useState('');
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);

  // Active checked-in crew list
  const [activeCheckins, setActiveCheckins] = useState<ActiveCheckin[]>([]);

  // Manual entry — now 4-digit last-digits lookup
  const [manualDigits, setManualDigits] = useState('');
  const [showManual, setShowManual]   = useState(false);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualError, setManualError] = useState('');

  const resetVehicleSession = useCallback(() => {
    setSessionVehicle(null);
    setActiveCheckins([]);
    setScanState('idle');
    setScanResult(null);
    setPendingNfc('');
    setScanError('');
    setShowManual(false);
    setManualDigits('');
    setManualError('');
  }, []);

  useEffect(() => {
    const request = new AbortController();
    setVehicleSessionExpiredHandler(() => {
      resetVehicleSession();
      setLoginError('Vehicle session ended. Sign in again.');
    });
    void (async () => {
      try {
        if (!await SecureStore.getItemAsync('yt_vehicle_token')) return;
        const { data } = await vehicleApi.get<SessionVehicle>('/airlines/vehicles/session', { signal: request.signal });
        if (!request.signal.aborted) setSessionVehicle(data);
      } catch (error) {
        if (!request.signal.aborted && (!axios.isAxiosError(error) || error.response?.status !== 401)) {
          setLoginError('Unable to verify the saved vehicle session. Try signing in again.');
        }
      } finally {
        if (!request.signal.aborted) setRestoring(false);
      }
    })();
    return () => { request.abort(); setVehicleSessionExpiredHandler(null); };
  }, [resetVehicleSession]);

  const sessionVehicleId = sessionVehicle?.vehicleId;
  useEffect(() => {
    if (!sessionVehicleId) return;
    const request = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    void vehicleApi.get<ActiveCheckin[]>('/airlines/trips/active-trips', {
      params: { vehicleId: sessionVehicleId }, signal: request.signal,
    }).then(({ data }) => {
      if (!request.signal.aborted) setActiveCheckins(data);
    }).catch(() => {});

    const refresh = async () => {
      try {
        const { data } = await vehicleApi.get<SessionVehicle>('/airlines/vehicles/session', { signal: request.signal });
        if (!request.signal.aborted) setSessionVehicle(data);
      } catch {
        // Authorization failures are handled by the interceptor.
      }
      if (!request.signal.aborted) timer = setTimeout(refresh, 30_000);
    };
    timer = setTimeout(refresh, 30_000);
    return () => { request.abort(); clearTimeout(timer); };
  }, [sessionVehicleId]);

  // Disable Android hardware back button after vehicle login
  useEffect(() => {
    if (!sessionVehicle) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [sessionVehicle]);

  // ── Vehicle login ──────────────────────────────────────────────────────────
  const vehicleLogin = async () => {
    if (loginLoading || !plateInput.trim() || !/^\d{4}$/.test(pinInput)) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await vehicleApi.post<{ token: string } & SessionVehicle>('/airlines/vehicles/login', {
        plateNumber: plateInput.trim(), pin: pinInput,
      });
      const { token, ...vehicleData } = res.data;
      await SecureStore.setItemAsync('yt_vehicle_token', token);
      resetVehicleSession();
      setSessionVehicle(vehicleData);
      setPlateInput('');
      setPinInput('');
    } catch (err: any) {
      setLoginError(err?.response?.data?.message ?? 'Login failed. Check plate number and PIN.');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── NFC availability check ─────────────────────────────────────────────────
  useEffect(() => {
    if (!NfcManager) { setNfcSupported(false); return; }
    NfcManager.isSupported().then((ok: boolean) => setNfcSupported(ok)).catch(() => setNfcSupported(false));
  }, []);

  // ── Process a card UID ─────────────────────────────────────────────────────
  const processUid = async (uid: string) => {
    setScanState('confirming');
    setPendingNfc(uid);
    try {
      const statusRes = await vehicleApi.get<{ trip: any | null; crew: any } | null>(`/airlines/trips/scan-status?nfcUid=${uid}`);
      const data = statusRes.data;
      if (!data) {
        setScanError('NFC card not registered in system');
        setScanState('idle');
        return;
      }
      setScanResult({
        action: data.trip ? 'checkout' : 'checkin',
        crew: { id: data.crew.id, displayId: data.crew.displayId, name: data.crew.name, designation: data.crew.designation },
        tripId: data.trip?.id,
      });
      setScanState('result');
    } catch (err: any) {
      setScanError(err?.response?.data?.message ?? 'Card not registered');
      setScanState('idle');
    }
  };

  // ── Scan NFC ───────────────────────────────────────────────────────────────
  const startScan = useCallback(async () => {
    if (!NfcManager || !nfcSupported) { setShowManual(true); return; }
    setScanState('scanning');
    setScanError('');
    try {
      await NfcManager.requestTechnology(NfcTech.NfcA);
      const tag = await NfcManager.getTag();
      const uid: string = tag?.id ?? '';
      if (!uid) throw new Error('Could not read card UID');
      await processUid(uid);
    } catch (err: any) {
      if (err?.message !== 'UserCancel') setScanError(err?.message ?? 'Scan failed');
      setScanState('idle');
    } finally {
      NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  }, [nfcSupported]);

  const cancelScan = () => {
    NfcManager?.cancelTechnologyRequest().catch(() => {});
    setScanState('idle');
    setScanError('');
  };

  const confirmAction = async () => {
    if (!scanResult || !sessionVehicle) return;
    setScanState('confirming');
    try {
      const location = await getScannerLocation().catch(() => undefined);
      if (scanResult.action === 'checkin') {
        const res = await vehicleApi.post('/airlines/trips/checkin', {
          nfcUid: pendingNfc, vehicleId: sessionVehicle.vehicleId, location,
        });
        setScanResult(prev => prev ? { ...prev, checkinAt: res.data.checkinAt, checkinStop: res.data.checkinStop } : prev);
        setActiveCheckins(prev => [...prev, {
          tripId: res.data.tripId,
          crewName: scanResult.crew.name,
          designation: scanResult.crew.designation,
          checkinAt: res.data.checkinAt,
        }]);
      } else {
        const res = await vehicleApi.post('/airlines/trips/checkout', { nfcUid: pendingNfc, location });
        setScanResult(prev => prev ? { ...prev, checkoutAt: res.data.checkoutAt, checkoutStop: res.data.checkoutStop, kmTravelled: res.data.kmTravelled } : prev);
        setActiveCheckins(prev => prev.filter(c => c.tripId !== scanResult.tripId));
      }
      setScanState('success');
      setTimeout(() => { setScanState('idle'); setScanResult(null); setPendingNfc(''); setScanError(''); }, 3000);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not complete action');
      setScanState('result');
    }
  };

  const resetScan = () => { setScanState('idle'); setScanResult(null); setPendingNfc(''); setScanError(''); };

  // ── Manual entry — lookup by last 4 digits ─────────────────────────────────
  const submitManualDigits = async () => {
    if (manualDigits.length !== 4) return;
    setManualLoading(true);
    setManualError('');
    try {
      const res = await vehicleApi.get<{ nfcUid: string }>(`/airlines/crews/lookup-uid?digits=${manualDigits}`);
      setShowManual(false);
      setManualDigits('');
      await processUid(res.data.nfcUid);
    } catch (err: any) {
      setManualError(err?.response?.data?.message ?? 'Card not found');
    } finally {
      setManualLoading(false);
    }
  };

  // ── Loading — checking stored session ─────────────────────────────────────
  if (restoring) {
    return (
      <SafeAreaView style={s.loginSafe}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={t.red} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  // ── Vehicle login screen ───────────────────────────────────────────────────
  if (!sessionVehicle) {
    return (
      <SafeAreaView style={s.loginSafe}>
        <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
        <Pressable onPress={() => router.replace('/login')} style={s.loginBack}>
          <TablerIcon name="arrow-left" size={20} color={t.ink} />
        </Pressable>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView
            contentContainerStyle={s.loginScroll}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Image source={logo} resizeMode="contain" style={s.loginLogo} accessibilityLabel="Trackvee" />
            <Text style={s.loginTitle}>Driver Login</Text>
            <Text style={s.loginSubtitle}>Enter your vehicle plate and PIN to start scanning.</Text>

            {loginError ? <Text style={s.loginError}>{loginError}</Text> : null}

            <Text style={s.loginLabel}>Vehicle Plate Number</Text>
            <TextInput
              style={s.loginInput}
              value={plateInput}
              onChangeText={v => setPlateInput(v.toUpperCase())}
              placeholder="e.g. LEH-7985"
              placeholderTextColor={t.muted}
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="next"
            />

            <Text style={[s.loginLabel, { marginTop: 20 }]}>PIN</Text>
            <PinInput value={pinInput} onChange={setPinInput} theme={t} />

            <Pressable
              onPress={vehicleLogin}
              disabled={loginLoading || !plateInput.trim() || pinInput.length !== 4}
              style={[s.loginBtn, (loginLoading || !plateInput.trim() || pinInput.length !== 4) && { opacity: 0.55 }]}
            >
              {loginLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={s.loginBtnText}>Sign in</Text>}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // ── Scan screen (full screen, no back) ────────────────────────────────────
  return (
    <SafeAreaView style={s.container}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false, fullScreenGestureEnabled: false }} />

      <View style={s.topBar} />

      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 12 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* ── IDLE / SCANNING ─────────────────────────────────────────── */}
        {(scanState === 'idle' || scanState === 'scanning') && (
          <>
            {/* Airline logo + name + vehicle number */}
            {sessionVehicle.logoData ? (
              <Image source={{ uri: sessionVehicle.logoData }} style={s.airlineLogo} resizeMode="contain" />
            ) : null}
            <Text style={s.headerAirline} numberOfLines={1}>{sessionVehicle.airlineName}</Text>
            <Text style={s.headerVehicle} numberOfLines={1}>
              {sessionVehicle.licensePlate || sessionVehicle.vehicleName}
            </Text>

            {/* Active checked-in crew list */}
            {activeCheckins.length > 0 && (
              <View style={s.checkinPanel}>
                <ScrollView style={{ maxHeight: 180 }} showsVerticalScrollIndicator={false}>
                  {activeCheckins.map((item, i) => {
                    const time = new Date(item.checkinAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
                    return (
                      <View key={item.tripId} style={[s.checkinRow, i < activeCheckins.length - 1 && { borderBottomWidth: 1, borderBottomColor: t.border }]}>
                        <View style={{ flex: 1 }}>
                          <Text style={s.checkinName} numberOfLines={1}>{item.crewName}</Text>
                          <Text style={s.checkinSub}>{item.designation || 'Crew'} · {time}</Text>
                        </View>
                        <LiveTimer checkinAt={item.checkinAt} />
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* Large tappable WiFi-style scan icon — faded/watermark when idle */}
            <Pressable
              onPress={scanState === 'idle' ? startScan : cancelScan}
              style={({ pressed }) => [s.wifiIconWrap, pressed && { opacity: 0.5 }]}
            >
              <View style={{ position: 'relative', width: 220, height: 220, justifyContent: 'center', alignItems: 'center' }}>
                {scanState === 'scanning' && (
                  <>
                    <PulseRing color="#dc2626" delay={0} />
                    <PulseRing color="#dc2626" delay={500} />
                  </>
                )}
                <View style={{ opacity: scanState === 'idle' ? 0.18 : 1 }}>
                  <WifiScanIcon size={160} color={scanState === 'scanning' ? '#dc2626' : t.ink} />
                </View>
              </View>
            </Pressable>

            <Text style={s.scanTitle}>
              {scanState === 'scanning' ? 'Hold card near device…' : 'Tap to scan'}
            </Text>
            <Text style={s.scanSubtitle}>
              {scanState === 'scanning'
                ? 'Keep the NFC card steady until it vibrates'
                : 'Or tap icon to enter card digits manually'}
            </Text>

            {scanError ? <Text style={s.errorText}>{scanError}</Text> : null}

            {scanState === 'scanning' && (
              <Pressable onPress={cancelScan} style={[s.secondaryBtn, { marginTop: 28, width: '100%' }]}>
                <Text style={s.secondaryBtnText}>Cancel</Text>
              </Pressable>
            )}
          </>
        )}

        {/* ── RESULT / CONFIRM ────────────────────────────────────────── */}
        {(scanState === 'result' || scanState === 'confirming') && scanResult && (
          <View style={{ width: '100%' }}>
            <View style={s.crewCard}>
              <View style={[s.crewAvatar, { backgroundColor: scanResult.action === 'checkin' ? '#f0fdf4' : '#fff0f0' }]}>
                <TablerIcon name="user" size={28} color={scanResult.action === 'checkin' ? '#059669' : '#dc2626'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.crewName}>{scanResult.crew.name}</Text>
                <Text style={s.crewDesig}>{scanResult.crew.designation || 'Crew'} · #{scanResult.crew.displayId}</Text>
              </View>
              <View style={[s.actionBadge, { backgroundColor: scanResult.action === 'checkin' ? '#f0fdf4' : '#fff0f0' }]}>
                <Text style={[s.actionBadgeText, { color: scanResult.action === 'checkin' ? '#059669' : '#dc2626' }]}>
                  {scanResult.action === 'checkin' ? 'CHECK IN' : 'CHECK OUT'}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
              <Pressable
                onPress={confirmAction}
                disabled={scanState === 'confirming'}
                style={[s.actionCard, { backgroundColor: scanResult.action === 'checkin' ? '#059669' : '#dc2626', flex: 1 }]}
              >
                {scanState === 'confirming'
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <>
                      <TablerIcon name={scanResult.action === 'checkin' ? 'check' : 'logout'} size={28} color="#fff" />
                      <Text style={s.actionCardText}>{scanResult.action === 'checkin' ? 'Check In' : 'Check Out'}</Text>
                    </>}
              </Pressable>
              <Pressable onPress={resetScan} style={[s.actionCard, { backgroundColor: t.card, borderWidth: 1, borderColor: t.border, flex: 1 }]}>
                <TablerIcon name="x" size={28} color={t.secondary} />
                <Text style={[s.actionCardText, { color: t.secondary }]}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── SUCCESS ──────────────────────────────────────────────────── */}
        {scanState === 'success' && scanResult && (
          <View style={{ alignItems: 'center' }}>
            <View style={[s.successCircle, { backgroundColor: scanResult.action === 'checkin' ? '#f0fdf4' : '#fff0f0' }]}>
              <TablerIcon name="check" size={48} color={scanResult.action === 'checkin' ? '#059669' : '#dc2626'} />
            </View>
            <Text style={s.successTitle}>{scanResult.action === 'checkin' ? 'Checked In!' : 'Checked Out!'}</Text>
            <Text style={s.crewName}>{scanResult.crew.name}</Text>
            <Text style={s.scanSubtitle}>
              {(scanResult.action === 'checkin' ? scanResult.checkinStop : scanResult.checkoutStop) ?? 'Location unavailable'}
            </Text>
            {scanResult.action === 'checkout' && scanResult.kmTravelled != null && (
              <Text style={s.kmText}>{Number(scanResult.kmTravelled).toFixed(1)} km travelled</Text>
            )}
            <Text style={s.scanSubtitle}>Ready for next scan in 3s…</Text>
          </View>
        )}
      </ScrollView>

      {/* Manual 4-digit entry modal */}
      {showManual && (
        <View style={s.manualOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={[s.manualSheet, { backgroundColor: t.card }]}>
              <Text style={s.manualTitle}>Enter last 4 digits of card</Text>
              <Text style={s.manualSub}>Type the last 4 characters shown on the NFC card</Text>
              <PinInput value={manualDigits} onChange={setManualDigits} theme={t} />
              {manualError ? <Text style={[s.errorText, { marginTop: 10 }]}>{manualError}</Text> : null}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <Pressable
                  onPress={() => { setShowManual(false); setManualDigits(''); setManualError(''); }}
                  style={[s.secondaryBtn, { flex: 1 }]}
                >
                  <Text style={s.secondaryBtnText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={submitManualDigits}
                  disabled={manualDigits.length !== 4 || manualLoading}
                  style={[s.primaryBtn, { flex: 1, opacity: manualDigits.length !== 4 || manualLoading ? 0.55 : 1 }]}
                >
                  {manualLoading
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={s.primaryBtnText}>Find Card</Text>}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    // ── Login screen ──
    loginSafe:      { flex: 1, backgroundColor: t.bg },
    loginBack:      { height: 42, width: 42, justifyContent: 'center', marginLeft: 22 },
    loginScroll:    { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 40 },
    loginLogo:      { width: 210, height: 60, alignSelf: 'center', marginBottom: 30 },
    loginTitle:     { fontSize: 30, fontWeight: '700' as const, color: t.ink, letterSpacing: -0.6 },
    loginSubtitle:  { fontSize: 15, color: t.secondary, marginTop: 8, marginBottom: 28 },
    loginLabel:     { fontSize: 13, fontWeight: '600' as const, color: t.ink, marginBottom: 8 },
    loginInput:     { height: 52, borderColor: t.border, borderWidth: 1, borderRadius: 7, paddingHorizontal: 14, fontSize: 15, color: t.ink, backgroundColor: t.inputBg },
    loginBtn:       { marginTop: 30, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: t.red, borderRadius: 8 },
    loginBtnText:   { color: '#fff', fontSize: 16, fontWeight: '700' as const },
    loginError:     { color: t.red, fontSize: 13, marginBottom: 16 },

    // ── Scan screen ──
    container:      { flex: 1, backgroundColor: t.bg },
    topBar:         { height: 8 },

    airlineLogo:    { width: 120, height: 56, alignSelf: 'center', marginBottom: 6 },
    headerAirline:  { fontSize: 18, fontWeight: '700' as const, color: t.ink, textAlign: 'center', marginBottom: 2 },
    headerVehicle:  { fontSize: 14, color: t.secondary, textAlign: 'center', marginBottom: 8 },

    checkinPanel:   { width: '100%', backgroundColor: t.card, borderRadius: 10, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: t.border },
    checkinRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 6 },
    checkinName:    { fontSize: 14, fontWeight: '600' as const, color: t.ink },
    checkinSub:     { fontSize: 11, color: t.secondary, marginTop: 1 },

    actionCard:     { alignItems: 'center', justifyContent: 'center', gap: 8, padding: 20, borderRadius: 14 },
    actionCardText: { color: '#fff', fontSize: 14, fontWeight: '700' as const },

    wifiIconWrap:   { marginBottom: 32 },

    scanTitle:      { fontSize: 20, fontWeight: '700' as const, color: t.ink, textAlign: 'center', marginBottom: 8 },
    scanSubtitle:   { fontSize: 13, color: t.secondary, textAlign: 'center' },
    errorText:      { color: '#dc2626', fontSize: 13, textAlign: 'center', marginTop: 12 },
    primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', padding: 15, borderRadius: 12 },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
    secondaryBtn:   { alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg2 },
    secondaryBtnText: { fontSize: 14, color: t.secondary, fontWeight: '500' as const },

    crewCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.card, borderRadius: 14, padding: 14, marginBottom: 12 },
    crewAvatar:     { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    crewName:       { fontSize: 17, fontWeight: '700' as const, color: t.ink },
    crewDesig:      { fontSize: 12, color: t.secondary, marginTop: 2 },
    actionBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    actionBadgeText:{ fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
    successCircle:  { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    successTitle:   { fontSize: 24, fontWeight: '800' as const, color: t.ink, marginBottom: 6 },
    kmText:         { fontSize: 18, fontWeight: '700' as const, color: '#059669', marginTop: 8, marginBottom: 4 },

    manualOverlay:  { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    manualSheet:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 36 },
    manualTitle:    { fontSize: 17, fontWeight: '700' as const, color: t.ink, textAlign: 'center', marginBottom: 4 },
    manualSub:      { fontSize: 13, color: t.secondary, textAlign: 'center', marginBottom: 8 },
  });
}
