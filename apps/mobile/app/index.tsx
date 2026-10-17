import { useEffect, useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Svg, { Path, Circle } from 'react-native-svg';
import logo from '../assets/trackvee-logo.png';
import { useAuth } from '../src/auth/AuthProvider';
import { useTheme } from '../src/hooks/useTheme';
import type { AppTheme } from '../src/theme';

export default function GetStartedScreen() {
  const t = useTheme();
  const styles = useMemo(() => createStyles(t), [t]);
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) router.replace('/map');
  }, [loading, user]);

  if (loading || user) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={t.red} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <Image source={logo} resizeMode="contain" style={styles.logo} accessibilityLabel="Trackvee" />
          <Text style={styles.title}>Track your fleet{ '\n' }with confidence</Text>
          <Text style={styles.subtitle}>Real-time location. Greater control.{ '\n' }A more efficient tomorrow.</Text>
          <View style={styles.routeArt} accessibilityElementsHidden>
            <Svg width="100%" height="100%" viewBox="0 0 350 205" fill="none">
              <Path d="M-8 150C54 150 44 88 112 88s45 83 111 83 49-69 141-69" stroke="#d9dee5" strokeWidth="24" />
              <Path d="M-8 150C54 150 44 88 112 88s45 83 111 83 49-69 141-69" stroke="#fff" strokeWidth="2" strokeDasharray="8 10" />
              <Path d="M80 54v45M210 112v45M300 26v54" stroke={t.red} strokeWidth="2" />
              <Circle cx="80" cy="52" r="9" fill={t.red} />
              <Circle cx="210" cy="110" r="9" fill={t.red} />
              <Circle cx="300" cy="24" r="9" fill={t.red} />
              <Path d="M73 52h14M80 45v14M203 110h14M210 103v14M293 24h14M300 17v14" stroke="#fff" strokeWidth="1.5" />
            </Svg>
          </View>
        </View>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => router.push('/login')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Get Started</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push('/login')} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Already have an account? <Text style={styles.link}>Sign in</Text></Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(t: AppTheme) { return StyleSheet.create({
  safe: { flex: 1, backgroundColor: t.bg },
  content: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20, paddingBottom: 18 },
  hero: { flex: 1, justifyContent: 'center' },
  logo: { width: 220, height: 62, alignSelf: 'center', marginBottom: 30 },
  title: { fontSize: 32, lineHeight: 39, fontWeight: '700', color: t.ink, letterSpacing: -0.7 },
  subtitle: { fontSize: 16, lineHeight: 24, color: t.secondary, marginTop: 12 },
  routeArt: { height: 190, marginTop: 24, marginHorizontal: -18 },
  actions: { marginTop: 14, marginBottom: 8 },
  primaryButton: { height: 54, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: t.red },
  pressed: { opacity: 0.82 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { height: 54, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { color: t.secondary, fontSize: 14 },
  link: { color: t.red, fontWeight: '600' },
}); }
