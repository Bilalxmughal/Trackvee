import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Animated, Easing, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { TablerIcon } from '../src/components/TablerIcon';
import api from '../src/lib/api';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';

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
}

interface ScanResult {
  action: 'checkin' | 'checkout';
  crew: { id: string; displayId: number; name: string; designation: string | null };
  tripId?: string;
  checkinAt?: string;
  checkoutAt?: string;
  checkinStop?: string;
  checkoutStop?: string;
  kmTravelled?: number | null;
}

// ─── Pulse animation ──────────────────────────────────────────────────────────

function PulseRing({ color, delay }: { color: string; delay: number }) {
  const scale = useRef(new Animated.Value(0.6)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.8, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 0.6, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale, opacity, delay]);

  return (
    <Animated.View style={{
      position: 'absolute', width: 120, height: 120, borderRadius: 60,
      borderWidth: 2, borderColor: color,
      transform: [{ scale }], opacity,
    }} />
  );
}

// ─── OTP PIN Input ────────────────────────────────────────────────────────────

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const refs = [
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
    useRef<TextInput>(null),
  ];

  const digits = value.split('').concat(['', '', '', '']).slice(0, 4);

  const handleChange = (index: number, text: string) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const arr = digits.map((d, i) => (i === index ? digit : d));
    onChange(arr.join(''));
    if (digit && index < 3) {
      refs[index + 1].current?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      const arr = digits.map((d, i) => (i === index - 1 ? '' : d));
      onChange(arr.join(''));
      refs[index - 1].current?.focus();
    }
  };

  return (
    <View style={{ flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 8 }}>
      {digits.map((d, i) => (
        <TextInput
          key={i}
          ref={refs[i]}
          style={{
            width: 60, height: 64, borderRadius: 12,
            borderWidth: 2,
            borderColor: d ? '#dc2626' : '#e0e0e0',
            fontSize: 28, fontWeight: '800' as const,
            textAlign: 'center', color: '#111',
            backgroundColor: '#fff',
          }}
          value={d}
          onChangeText={text => handleChange(i, text)}
          onKeyPress={({ nativeEvent }) => handleKeyPress(i, nativeEvent.key)}
          keyboardType="number-pad"
          maxLength={2}
          secureTextEntry
          caretHidden
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
  const [plateInput, setPlateInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  const [flightNumber, setFlightNumber] = useState('');
  const [setupDone, setSetupDone] = useState(false);

  const [scanState, setScanState] = useState<ScanState>('idle');
  const [pendingNfc, setPendingNfc] = useState('');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState('');
  const [nfcSupported, setNfcSupported] = useState<boolean | null>(null);

  const [manualUid, setManualUid] = useState('');
  const [showManual, setShowManual] = useState(false);

  // ── Vehicle login ──────────────────────────────────────────────────────────
  const vehicleLogin = async () => {
    if (!plateInput.trim() || pinInput.length !== 4) return;
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await api.post<{ token: string } & SessionVehicle>('/airlines/vehicles/login', {
        plateNumber: plateInput.trim(),
        pin: pinInput,
      });
      const { token, vehicleId, airlineId, vehicleName, licensePlate, airlineName, iataCode } = res.data;
      await SecureStore.setItemAsync('yt_token', token);
      setSessionVehicle({ vehicleId, airlineId, vehicleName, licensePlate, airlineName, iataCode });
      setPlateInput('');
      setPinInput('');
    } catch (err: any) {
      setLoginError(err?.response?.data?.message ?? 'Login failed. Check plate number and PIN.');
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    setSessionVehicle(null);
    setSetupDone(false);
    setFlightNumber('');
    setScanState('idle');
    setScanResult(null);
    setPendingNfc('');
    setScanError('');
    router.replace('/login');
  };

  // ── NFC availability check ─────────────────────────────────────────────────
  useEffect(() => {
    if (!NfcManager) { setNfcSupported(false); return; }
    NfcManager.isSupported().then((ok: boolean) => setNfcSupported(ok)).catch(() => setNfcSupported(false));
  }, []);

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

  const processUid = async (uid: string) => {
    setScanState('confirming');
    setPendingNfc(uid);
    try {
      const statusRes = await api.get<{ trip: any; crew: any } | null>(`/airlines/trips/scan-status?nfcUid=${uid}`);
      const existing = statusRes.data;
      setScanResult({
        action: existing ? 'checkout' : 'checkin',
        crew: existing
          ? { id: existing.crew.id, displayId: existing.crew.displayId, name: existing.crew.name, designation: existing.crew.designation }
          : { id: '', displayId: 0, name: 'Unknown', designation: null },
        tripId: existing?.trip?.id,
      });
      setScanState('result');
    } catch (err: any) {
      setScanError(err?.response?.data?.message ?? 'Card not registered');
      setScanState('idle');
    }
  };

  const confirmAction = async () => {
    if (!scanResult || !sessionVehicle) return;
    setScanState('confirming');
    try {
      if (scanResult.action === 'checkin') {
        const res = await api.post('/airlines/trips/checkin', {
          nfcUid: pendingNfc,
          vehicleId: sessionVehicle.vehicleId,
          flightNumber: flightNumber.trim() || undefined,
          lat: 0, lng: 0,
        });
        setScanResult(prev => prev ? { ...prev, checkinAt: res.data.checkinAt, checkinStop: res.data.checkinStop } : prev);
      } else {
        const res = await api.post('/airlines/trips/checkout', { nfcUid: pendingNfc, lat: 0, lng: 0 });
        setScanResult(prev => prev ? { ...prev, checkoutAt: res.data.checkoutAt, kmTravelled: res.data.kmTravelled } : prev);
      }
      setScanState('success');
      setTimeout(() => {
        setScanState('idle');
        setScanResult(null);
        setPendingNfc('');
        setScanError('');
      }, 3000);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message ?? 'Could not complete action');
      setScanState('result');
    }
  };

  const resetScan = () => {
    setScanState('idle');
    setScanResult(null);
    setPendingNfc('');
    setScanError('');
  };

  const submitManual = async () => {
    if (!manualUid.trim()) return;
    setShowManual(false);
    await processUid(manualUid.trim());
    setManualUid('');
  };

  // ── Vehicle login screen ───────────────────────────────────────────────────
  if (!sessionVehicle) {
    return (
      <SafeAreaView style={[s.container, { flex: 1 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.header}>
          <Pressable onPress={() => router.replace('/login')} style={s.backBtn}>
            <TablerIcon name="arrow-left" size={20} color={t.ink} />
          </Pressable>
          <Text style={s.title}>Driver Login</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 16 }} keyboardShouldPersistTaps="handled">

          <Text style={s.fieldLabel}>Vehicle Plate Number</Text>
          <TextInput
            style={s.input}
            value={plateInput}
            onChangeText={v => setPlateInput(v.toUpperCase())}
            placeholder="e.g. LEH-7985"
            placeholderTextColor={t.muted}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <Text style={[s.fieldLabel, { marginTop: 24 }]}>PIN</Text>
          <PinInput value={pinInput} onChange={setPinInput} />

          {loginError ? <Text style={s.errorText}>{loginError}</Text> : null}

          <Pressable
            onPress={vehicleLogin}
            disabled={loginLoading || !plateInput.trim() || pinInput.length !== 4}
            style={[s.primaryBtn, { marginTop: 32 }, (loginLoading || !plateInput.trim() || pinInput.length !== 4) && { opacity: 0.4 }]}
          >
            {loginLoading
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={s.primaryBtnText}>Login</Text>}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Flight number screen ───────────────────────────────────────────────────
  if (!setupDone) {
    return (
      <SafeAreaView style={[s.container, { flex: 1 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={s.header}>
          <Pressable onPress={logout} style={s.backBtn}>
            <TablerIcon name="arrow-left" size={20} color={t.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Start Scanning</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingTop: 16 }}>
          {/* Vehicle info row */}
          <View style={s.vehicleRow}>
            <TablerIcon name="car" size={18} color="#dc2626" />
            <Text style={s.vehicleRowText} numberOfLines={1}>
              {sessionVehicle.licensePlate || sessionVehicle.vehicleName}
              {' · '}{sessionVehicle.airlineName}{sessionVehicle.iataCode ? ` (${sessionVehicle.iataCode})` : ''}
            </Text>
            <Pressable onPress={logout} hitSlop={10}>
              <TablerIcon name="logout" size={16} color={t.muted} />
            </Pressable>
          </View>

          <Text style={[s.fieldLabel, { marginTop: 24 }]}>Flight Number <Text style={{ fontWeight: '400' as const, color: t.muted }}>(optional)</Text></Text>
          <TextInput
            style={s.input}
            value={flightNumber}
            onChangeText={setFlightNumber}
            placeholder="e.g. PK-301"
            placeholderTextColor={t.muted}
            autoCapitalize="characters"
          />

          <Pressable onPress={() => setSetupDone(true)} style={[s.primaryBtn, { marginTop: 28 }]}>
            <TablerIcon name="nfc" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>Start Scanning</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Scan screen ────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[s.container, { flex: 1 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => setSetupDone(false)} style={s.backBtn}>
          <TablerIcon name="arrow-left" size={20} color={t.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Crew Scan</Text>
          <Text style={s.subtitle} numberOfLines={1}>
            {sessionVehicle.licensePlate || sessionVehicle.vehicleName}
            {` · ${sessionVehicle.airlineName}`}
            {flightNumber ? ` · ${flightNumber}` : ''}
          </Text>
        </View>
        <Pressable onPress={logout} style={s.backBtn}>
          <TablerIcon name="logout" size={18} color={t.muted} />
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 }}>

        {/* ── IDLE / SCANNING ─────────────────────────────────────────────── */}
        {(scanState === 'idle' || scanState === 'scanning') && (
          <>
            <View style={{ position: 'relative', width: 160, height: 160, justifyContent: 'center', alignItems: 'center', marginBottom: 28 }}>
              {scanState === 'scanning' && (
                <>
                  <PulseRing color="#dc2626" delay={0} />
                  <PulseRing color="#dc2626" delay={500} />
                </>
              )}
              <View style={[s.nfcCircle, { borderColor: scanState === 'scanning' ? '#dc2626' : t.border }]}>
                <TablerIcon name="nfc" size={52} color={scanState === 'scanning' ? '#dc2626' : t.secondary} />
              </View>
            </View>

            <Text style={s.scanTitle}>
              {scanState === 'scanning' ? 'Hold card near device…' : 'Ready to scan'}
            </Text>
            <Text style={s.scanSubtitle}>
              {scanState === 'scanning'
                ? 'Keep the NFC card steady until it vibrates'
                : 'Tap the button to scan crew NFC card'}
            </Text>

            {scanError ? <Text style={s.errorText}>{scanError}</Text> : null}

            {scanState === 'idle' ? (
              <View style={{ gap: 10, width: '100%', marginTop: 28 }}>
                <Pressable onPress={startScan} style={s.primaryBtn}>
                  <TablerIcon name="nfc" size={18} color="#fff" />
                  <Text style={s.primaryBtnText}>
                    {nfcSupported === false ? 'Manual Entry' : 'Scan Card'}
                  </Text>
                </Pressable>
                {nfcSupported !== false && (
                  <Pressable onPress={() => setShowManual(true)} style={s.secondaryBtn}>
                    <Text style={s.secondaryBtnText}>Enter UID manually</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <Pressable onPress={cancelScan} style={[s.secondaryBtn, { marginTop: 28, width: '100%' }]}>
                <Text style={s.secondaryBtnText}>Cancel</Text>
              </Pressable>
            )}
          </>
        )}

        {/* ── RESULT / CONFIRM ────────────────────────────────────────────── */}
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

            {scanResult.action === 'checkin' && flightNumber ? (
              <View style={s.infoRow}>
                <TablerIcon name="plane" size={14} color={t.secondary} />
                <Text style={s.infoText}>Flight: {flightNumber}</Text>
              </View>
            ) : null}

            <View style={{ gap: 10, marginTop: 20 }}>
              <Pressable
                onPress={confirmAction}
                disabled={scanState === 'confirming'}
                style={[s.primaryBtn, { backgroundColor: scanResult.action === 'checkin' ? '#059669' : '#dc2626' }]}
              >
                {scanState === 'confirming'
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.primaryBtnText}>Confirm {scanResult.action === 'checkin' ? 'Check In' : 'Check Out'}</Text>}
              </Pressable>
              <Pressable onPress={resetScan} style={s.secondaryBtn}>
                <Text style={s.secondaryBtnText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── SUCCESS ──────────────────────────────────────────────────────── */}
        {scanState === 'success' && scanResult && (
          <View style={{ alignItems: 'center' }}>
            <View style={[s.successCircle, { backgroundColor: scanResult.action === 'checkin' ? '#f0fdf4' : '#fff0f0' }]}>
              <TablerIcon name="check" size={48} color={scanResult.action === 'checkin' ? '#059669' : '#dc2626'} />
            </View>
            <Text style={s.successTitle}>
              {scanResult.action === 'checkin' ? 'Checked In!' : 'Checked Out!'}
            </Text>
            <Text style={s.crewName}>{scanResult.crew.name}</Text>
            {scanResult.action === 'checkout' && scanResult.kmTravelled != null && (
              <Text style={s.kmText}>{Number(scanResult.kmTravelled).toFixed(1)} km travelled</Text>
            )}
            <Text style={s.scanSubtitle}>Ready for next scan in 3s…</Text>
          </View>
        )}
      </View>

      {/* Manual UID Modal */}
      {showManual && (
        <View style={s.manualOverlay}>
          <View style={[s.manualSheet, { backgroundColor: t.card }]}>
            <Text style={[s.fieldLabel, { marginBottom: 12 }]}>Enter NFC Card UID</Text>
            <TextInput
              style={s.input}
              value={manualUid}
              onChangeText={setManualUid}
              placeholder="e.g. 04A32FB1095C80"
              placeholderTextColor={t.muted}
              autoCapitalize="characters"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Pressable onPress={() => { setShowManual(false); setManualUid(''); }} style={[s.secondaryBtn, { flex: 1 }]}>
                <Text style={s.secondaryBtnText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={submitManual} style={[s.primaryBtn, { flex: 1 }]}>
                <Text style={s.primaryBtnText}>Confirm</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(t: AppTheme) {
  return StyleSheet.create({
    container:      { flex: 1, backgroundColor: t.bg },
    header:         { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
    backBtn:        { width: 34, height: 34, borderRadius: 10, backgroundColor: t.bg2, justifyContent: 'center', alignItems: 'center' },
    title:          { fontSize: 22, fontWeight: '800' as const, letterSpacing: -0.4, color: t.ink },
    subtitle:       { fontSize: 12, color: t.secondary, marginTop: 1 },
    fieldLabel:     { fontSize: 13, fontWeight: '600' as const, color: t.secondary, marginBottom: 6 },
    input:          { borderWidth: 1, borderColor: t.border, borderRadius: 10, padding: 12, fontSize: 15, color: t.ink, backgroundColor: t.card },
    primaryBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', padding: 15, borderRadius: 12 },
    primaryBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' as const },
    secondaryBtn:   { alignItems: 'center', justifyContent: 'center', padding: 13, borderRadius: 12, borderWidth: 1, borderColor: t.border, backgroundColor: t.bg2 },
    secondaryBtnText: { fontSize: 14, color: t.secondary, fontWeight: '500' as const },
    vehicleRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: t.border },
    vehicleRowText: { flex: 1, fontSize: 13, fontWeight: '600' as const, color: t.ink },
    nfcCircle:      { width: 120, height: 120, borderRadius: 60, borderWidth: 2, justifyContent: 'center', alignItems: 'center', backgroundColor: t.bg2 },
    scanTitle:      { fontSize: 20, fontWeight: '700' as const, color: t.ink, textAlign: 'center', marginBottom: 8 },
    scanSubtitle:   { fontSize: 14, color: t.secondary, textAlign: 'center' },
    errorText:      { color: '#dc2626', fontSize: 13, textAlign: 'center', marginTop: 12 },
    crewCard:       { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.card, borderRadius: 14, padding: 14, marginBottom: 12 },
    crewAvatar:     { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    crewName:       { fontSize: 17, fontWeight: '700' as const, color: t.ink },
    crewDesig:      { fontSize: 12, color: t.secondary, marginTop: 2 },
    actionBadge:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    actionBadgeText:{ fontSize: 11, fontWeight: '700' as const, letterSpacing: 0.5 },
    infoRow:        { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
    infoText:       { fontSize: 13, color: t.secondary },
    successCircle:  { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    successTitle:   { fontSize: 24, fontWeight: '800' as const, color: t.ink, marginBottom: 6 },
    kmText:         { fontSize: 18, fontWeight: '700' as const, color: '#059669', marginTop: 8, marginBottom: 4 },
    manualOverlay:  { position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    manualSheet:    { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  });
}
