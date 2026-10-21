import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [visible, setVisible] = useState(false);
  const slideY = useRef(new Animated.Value(-60)).current;
  const insets = useSafeAreaInsets();
  const t = useTheme();

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const offline = state.isConnected === false;
      if (offline) {
        setIsOffline(true);
        setVisible(true);
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 260 }).start();
      } else {
        Animated.timing(slideY, { toValue: -60, useNativeDriver: true, duration: 300 }).start(() => {
          setIsOffline(false);
          setVisible(false);
        });
      }
    });
    return () => unsub();
  }, [slideY]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingTop: insets.top + 6, backgroundColor: isOffline ? '#1a1a1a' : t.red, transform: [{ translateY: slideY }] },
      ]}
      pointerEvents="none"
    >
      <Text style={styles.text}>
        {isOffline ? '● No Internet Connection' : '✓ Back Online'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: 10,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
