import { useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';
import logo from '../assets/trackvee-logo.png';

export default function LoginScreen() {
  const { login, sessionRestoreFailed } = useAuth();
  const t = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => createStyles(t), [t]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      router.replace('/map');
    } catch (cause) {
      if (isAxiosError(cause) && !cause.response) {
        setError('Unable to connect. Check your internet connection and try again.');
      } else if (isAxiosError(cause) && (cause.response?.status ?? 0) >= 500) {
        setError('Trackvee is temporarily unavailable. Please try again shortly.');
      } else if (isAxiosError(cause) && cause.response?.status === 401) {
        setError('Invalid email or password');
      } else if (!isAxiosError(cause) && cause instanceof Error && cause.message === 'Use a Trackvee client account to sign in to the mobile app.') {
        setError(cause.message);
      } else {
        setError('Unable to sign in. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
        <TablerIcon name="back" size={22} color={t.ink} />
      </Pressable>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="Trackvee" />
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Access your fleet, anytime, anywhere.</Text>

          {sessionRestoreFailed && !error ? <Text accessibilityRole="alert" style={styles.error}>Unable to verify your saved session. Sign in again when your connection is available.</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="name@company.com" placeholderTextColor={t.muted} style={styles.input} accessibilityLabel="Email" />
          <Text style={[styles.label, styles.passwordLabel]}>Password</Text>
          <View style={styles.passwordBox}>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoComplete="current-password" textContentType="password" placeholder="Enter your password" placeholderTextColor={t.muted} style={[styles.input, styles.passwordInput]} accessibilityLabel="Password" onSubmitEditing={submit} returnKeyType="go" />
            <Pressable onPress={() => setVisible(v => !v)} hitSlop={12} style={styles.eye} accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
              <Text style={styles.eyeText}>{visible ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <Pressable disabled={busy || !email.trim() || !password} onPress={submit} style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, (busy || !email.trim() || !password) && styles.submitDisabled]}>
            <Text style={styles.submitText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
          <Text style={styles.privacy}>Your account is protected with secure sign-in.</Text>

          {/* Driver / Crew Scan entry */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable onPress={() => router.push('/scan')} style={({ pressed }) => [styles.scanBtn, pressed && { opacity: 0.75 }]}>
            <TablerIcon name="steering-wheel" size={16} color={t.secondary} />
            <Text style={styles.scanBtnTitle}>Airline Driver Login</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(t: AppTheme) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: t.bg }, fill: { flex: 1 },
    scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 28 },
    back: { height: 42, width: 42, justifyContent: 'center', marginLeft: 22, flexShrink: 0 },
    logo: { width: 210, height: 60, alignSelf: 'center', marginBottom: 30 },
    title: { fontSize: 30, fontWeight: '700', color: t.ink, letterSpacing: -0.6 },
    subtitle: { fontSize: 15, color: t.secondary, marginTop: 8, marginBottom: 34 },
    label: { fontSize: 13, fontWeight: '600', color: t.ink, marginBottom: 8 },
    passwordLabel: { marginTop: 20 },
    input: { height: 52, borderColor: t.border, borderWidth: 1, borderRadius: 7, paddingHorizontal: 14, fontSize: 15, color: t.ink, backgroundColor: t.inputBg },
    passwordBox: { position: 'relative', justifyContent: 'center' },
    passwordInput: { paddingRight: 62 },
    eye: { position: 'absolute', right: 14, padding: 5 },
    eyeText: { color: t.secondary, fontSize: 13, fontWeight: '600' },
    error: { color: t.red, fontSize: 13, marginBottom: 16 },
    submit: { marginTop: 30, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: t.red, borderRadius: 8 },
    submitPressed: { opacity: 0.84 }, submitDisabled: { opacity: 0.55 },
    submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    privacy: { color: t.muted, fontSize: 12, textAlign: 'center', marginTop: 22 },
    dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 28, marginBottom: 16, gap: 10 },
    dividerLine: { flex: 1, height: 1, backgroundColor: t.border },
    dividerText: { color: t.muted, fontSize: 12, fontWeight: '500' },
    scanBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 8, borderWidth: 1, borderColor: t.border, backgroundColor: t.card },
    scanBtnTitle: { fontSize: 14, fontWeight: '600', color: t.ink },
  });
}
