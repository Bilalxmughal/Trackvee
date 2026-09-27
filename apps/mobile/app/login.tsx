import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthProvider';
import { TablerIcon } from '../src/components/TablerIcon';
import { theme } from '../src/theme';
import logo from '../assets/trackvee-logo.png';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      } else {
        setError('Invalid email or password');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
        <TablerIcon name="back" size={22} color={theme.ink} />
      </Pressable>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="Trackvee" />
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Access your fleet, anytime, anywhere.</Text>

          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>Email</Text>
          <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress" placeholder="name@company.com" placeholderTextColor={theme.muted} style={styles.input} accessibilityLabel="Email" />
          <Text style={[styles.label, styles.passwordLabel]}>Password</Text>
          <View style={styles.passwordBox}>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry={!visible} autoComplete="current-password" textContentType="password" placeholder="Enter your password" placeholderTextColor={theme.muted} style={[styles.input, styles.passwordInput]} accessibilityLabel="Password" onSubmitEditing={submit} returnKeyType="go" />
            <Pressable onPress={() => setVisible(v => !v)} hitSlop={12} style={styles.eye} accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'}>
              <Text style={styles.eyeText}>{visible ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>
          <Pressable disabled={busy || !email.trim() || !password} onPress={submit} style={({ pressed }) => [styles.submit, pressed && styles.submitPressed, (busy || !email.trim() || !password) && styles.submitDisabled]}>
            <Text style={styles.submitText}>{busy ? 'Signing in…' : 'Sign in'}</Text>
          </Pressable>
          <Text style={styles.privacy}>Your account is protected with secure sign-in.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, fill: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 12, paddingBottom: 28 },
  back: { height: 42, width: 42, justifyContent: 'center', marginLeft: 22, flexShrink: 0 },
  logo: { width: 210, height: 60, alignSelf: 'center', marginBottom: 30 },
  title: { fontSize: 30, fontWeight: '700', color: theme.ink, letterSpacing: -0.6 },
  subtitle: { fontSize: 15, color: theme.secondary, marginTop: 8, marginBottom: 34 },
  label: { fontSize: 13, fontWeight: '600', color: theme.ink, marginBottom: 8 },
  passwordLabel: { marginTop: 20 },
  input: { height: 52, borderColor: theme.border, borderWidth: 1, borderRadius: 7, paddingHorizontal: 14, fontSize: 15, color: theme.ink },
  passwordBox: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 62 },
  eye: { position: 'absolute', right: 14, padding: 5 },
  eyeText: { color: theme.secondary, fontSize: 13, fontWeight: '600' },
  error: { color: theme.red, fontSize: 13, marginBottom: 16 },
  submit: { marginTop: 30, height: 54, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.red, borderRadius: 8 },
  submitPressed: { opacity: 0.84 }, submitDisabled: { opacity: 0.55 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  privacy: { color: theme.muted, fontSize: 12, textAlign: 'center', marginTop: 22 },
});
