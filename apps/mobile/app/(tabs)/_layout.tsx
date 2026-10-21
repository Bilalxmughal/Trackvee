import { Tabs } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TablerIcon } from '../../src/components/TablerIcon';
import { usePortalPermissions } from '../../src/auth/PortalPermissionsProvider';
import { useTheme } from '../../src/hooks/useTheme';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function TabItem({ route, focused, iconName, label, navigation, t }: { route: any; focused: boolean; iconName: string; label: string; navigation: any; t: any }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (focused) {
      Animated.sequence([
        Animated.spring(scale, { toValue: 1.28, useNativeDriver: true, damping: 6, stiffness: 400 }),
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, damping: 10, stiffness: 300 }),
      ]).start();
    }
  }, [focused, scale]);

  const onPress = () => {
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: focused }}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <TablerIcon name={iconName} size={22} color={focused ? t.red : t.secondary} />
      </Animated.View>
      {label ? <Text style={[styles.label, { color: focused ? t.red : t.secondary, fontWeight: focused ? '600' : '500' }]}>{label}</Text> : null}
    </Pressable>
  );
}

const ICON_NAMES: Record<string, string> = {
  map: 'map', vehicles: 'fleet', alerts: 'bell', reports: 'report', more: 'more',
};
const INDICATOR_W = 48;

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const tabCount = state.routes.length;
  const barWidth = useRef(0);
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (barWidth.current === 0) return;
    const tabW = barWidth.current / tabCount;
    const toX = tabW * state.index + tabW / 2 - INDICATOR_W / 2;
    Animated.spring(translateX, { toValue: toX, useNativeDriver: true, damping: 20, stiffness: 260, mass: 0.8 }).start();
  }, [state.index, tabCount, translateX]);

  return (
    <View
      style={[styles.bar, { backgroundColor: t.bg, borderTopColor: t.border, paddingBottom: Math.max(insets.bottom, 5) }]}
      onLayout={e => {
        barWidth.current = e.nativeEvent.layout.width;
        const tabW = barWidth.current / tabCount;
        translateX.setValue(tabW * state.index + tabW / 2 - INDICATOR_W / 2);
      }}
    >
      <Animated.View style={[styles.indicator, { backgroundColor: t.red, transform: [{ translateX }] }]} />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = options.title ?? route.name;
        const focused = state.index === index;
        const iconName = ICON_NAMES[route.name] ?? 'more';

        return (
          <TabItem
            key={route.key}
            route={route}
            focused={focused}
            iconName={iconName}
            label={label}
            navigation={navigation}
            t={t}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    paddingTop: 6,
    borderTopWidth: 0.5,
    overflow: 'visible',
  },
  indicator: {
    position: 'absolute',
    top: -6,
    left: 0,
    width: INDICATOR_W, height: 3,
    borderRadius: 2,
    shadowColor: '#e21d48',
    shadowOpacity: 0.5,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tab: { flex: 1, alignItems: 'center', paddingTop: 10, paddingBottom: 6, gap: 3 },
  label: { fontSize: 11, marginBottom: 0 },
});

export default function TabLayout() {
  const t = useTheme();
  const { canDo, loading } = usePortalPermissions();
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg }}><ActivityIndicator color={t.red} /></View>;
  return (
    <Tabs
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="map" options={{ title: '' }} />
      <Tabs.Screen name="vehicles" options={{ title: 'Vehicles', href: canDo('vehicles') ? '/vehicles' : null }} />
      <Tabs.Screen name="alerts" options={{ title: 'Alerts', href: canDo('alerts') ? '/alerts' : null }} />
      <Tabs.Screen name="reports" options={{ title: 'Reports', href: canDo('reports') ? '/reports' : null }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
