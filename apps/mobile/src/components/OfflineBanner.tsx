import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsOffline } from '../hooks/useIsOffline';

type BannerState = 'hidden' | 'offline' | 'back-online';

const BANNER_H = 36;

export function OfflineBanner() {
  const isOffline = useIsOffline();
  const [state, setState] = useState<BannerState>('hidden');
  const prevOffline = useRef<boolean | null>(null);
  const slideY = useRef(new Animated.Value(-BANNER_H)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();
  const backOnlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (prevOffline.current === null) {
      prevOffline.current = isOffline;
      if (isOffline) {
        setState('offline');
        slideY.setValue(0);
        opacity.setValue(1);
      }
      return;
    }

    const wasOffline = prevOffline.current;
    prevOffline.current = isOffline;

    if (backOnlineTimer.current) {
      clearTimeout(backOnlineTimer.current);
      backOnlineTimer.current = null;
    }

    if (isOffline) {
      // Show red offline banner
      opacity.setValue(1);
      setState('offline');
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 260,
      }).start();
    } else if (wasOffline) {
      // Show green "back online" then fade out
      opacity.setValue(1);
      setState('back-online');
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: true,
        damping: 18,
        stiffness: 260,
      }).start();

      backOnlineTimer.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          slideY.setValue(-BANNER_H);
          opacity.setValue(1);
          setState('hidden');
        });
      }, 2500);
    }
  }, [isOffline]);

  if (state === 'hidden') return null;

  const bgColor = state === 'offline' ? '#dc2626' : '#16a34a';
  const label = state === 'offline' ? 'No Internet Connection' : "You're back online";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        { paddingTop: insets.top + 8, backgroundColor: bgColor, transform: [{ translateY: slideY }], opacity },
      ]}
    >
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 8,
    alignItems: 'center',
    zIndex: 9999,
    elevation: 20,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
});
