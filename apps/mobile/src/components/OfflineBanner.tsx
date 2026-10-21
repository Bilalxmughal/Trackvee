import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BANNER_H = 36;

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const slideY = useRef(new Animated.Value(-BANNER_H)).current;
  const insets = useSafeAreaInsets();
  const initialized = useRef(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const isOffline = state.isConnected === false;

      // Skip the very first event — NetInfo fires immediately on mount
      // with current state; we only want to react to actual changes.
      if (!initialized.current) {
        initialized.current = true;
        if (isOffline) {
          setOffline(true);
          slideY.setValue(0);
        }
        return;
      }

      if (isOffline) {
        setOffline(true);
        Animated.spring(slideY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 18,
          stiffness: 260,
        }).start();
      } else if (offline) {
        Animated.timing(slideY, {
          toValue: -BANNER_H,
          useNativeDriver: true,
          duration: 280,
        }).start(() => setOffline(false));
      }
    });
    return () => unsub();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!offline) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.banner,
        { paddingTop: insets.top + 8, transform: [{ translateY: slideY }] },
      ]}
    >
      <Text style={styles.text}>No Internet Connection</Text>
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
    backgroundColor: '#111',
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
