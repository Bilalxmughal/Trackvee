import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import api from './api';
import { getDynamicNotificationSounds, installDynamicNotificationSounds, supportsDynamicNotificationSounds } from './dynamicNotificationSounds';

const TOKEN_KEY = 'yt_expo_push_token';
const PUSH_ENABLED_KEY = 'yt_mobile_push_enabled';
const SOUND_ENABLED_KEY = 'yt_mobile_alert_sound_enabled';
const RESUME_REFRESH_KEY = 'yt_fleet_refresh_on_resume';

export async function getAlertSoundEnabled(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SOUND_ENABLED_KEY)) !== 'false';
}

export async function setAlertSoundEnabled(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(SOUND_ENABLED_KEY, String(enabled));
}

export async function syncAlertSoundPreference(enabled: boolean): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) await api.patch('/alerts/push-token/preferences', { token, soundEnabled: enabled });
}

export async function getFleetRefreshOnResume(): Promise<boolean> {
  return (await SecureStore.getItemAsync(RESUME_REFRESH_KEY)) !== 'false';
}

export async function setFleetRefreshOnResume(enabled: boolean): Promise<void> {
  await SecureStore.setItemAsync(RESUME_REFRESH_KEY, String(enabled));
}

export const MOBILE_ALERT_SOUNDS = [
  { id: 'trackvee', label: 'Trackvee', file: 'trackvee_alert.wav', channelId: 'trackvee-alerts-tone-trackvee-v1' },
  { id: 'chime', label: 'Chime', file: 'trackvee_chime.wav', channelId: 'trackvee-alerts-tone-chime-v1' },
  { id: 'pulse', label: 'Pulse', file: 'trackvee_pulse.wav', channelId: 'trackvee-alerts-tone-pulse-v1' },
  { id: 'bell', label: 'Bell', file: 'trackvee_bell.wav', channelId: 'trackvee-alerts-tone-bell-v1' },
  { id: 'soft', label: 'Soft', file: 'trackvee_soft.wav', channelId: 'trackvee-alerts-tone-soft-v1' },
] as const;

export async function hasCachedPushRegistration(): Promise<boolean> {
  return !!(await SecureStore.getItemAsync(TOKEN_KEY));
}

export async function isPushNotificationsEnabled(): Promise<boolean> {
  const preference = await SecureStore.getItemAsync(PUSH_ENABLED_KEY);
  return preference === null ? hasCachedPushRegistration() : preference === 'true';
}

export async function syncPushRegistration(requestPermission: boolean, preferredSoundEnabled?: boolean): Promise<'enabled' | 'disabled' | 'denied' | 'unconfigured' | 'unsupported'> {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return 'unsupported';
  if (!requestPermission && !(await isPushNotificationsEnabled())) return 'disabled';
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('trackvee-alerts-custom-v1', {
      name: 'Trackvee alerts',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#dc2626',
      sound: 'trackvee_alert.wav',
    });
    for (const tone of MOBILE_ALERT_SOUNDS) {
      await Notifications.setNotificationChannelAsync(tone.channelId, {
        name: `Trackvee alerts · ${tone.label}`,
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#dc2626',
        sound: tone.file,
      });
    }
    await Notifications.setNotificationChannelAsync('trackvee-alerts-silent-v1', {
      name: 'Trackvee alerts · Silent',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#dc2626',
      sound: null,
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && requestPermission) permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted) return 'denied';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'unconfigured';
  const supportsDynamicSounds = supportsDynamicNotificationSounds();
  let dynamicSoundIds: string[] = [];
  if (supportsDynamicSounds) {
    try {
      const sounds = await getDynamicNotificationSounds();
      dynamicSoundIds = await installDynamicNotificationSounds(sounds);
    } catch {
      // Existing bundled tones continue to work when the shared catalog is temporarily unavailable.
    }
  }
  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  const token = result.data;
  const soundEnabled = preferredSoundEnabled ?? await getAlertSoundEnabled();
  const previous = await SecureStore.getItemAsync(TOKEN_KEY);
  if (previous && previous !== token) await api.delete('/alerts/push-token', { data: { token: previous } }).catch(() => {});
  await api.post('/alerts/push-token', { token, platform: Platform.OS, supportsCustomSounds: true, supportsDynamicSounds, dynamicSoundIds, soundEnabled });
  await SecureStore.setItemAsync(TOKEN_KEY, token);
  await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'true');
  return 'enabled';
}

export async function unregisterPushToken(requireServerConfirmation = false): Promise<void> {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!token) { await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'false'); return; }
  if (requireServerConfirmation) {
    await api.delete('/alerts/push-token', { data: { token } });
  } else {
    await api.delete('/alerts/push-token', { data: { token } }).catch(() => {});
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.setItemAsync(PUSH_ENABLED_KEY, 'false');
}

export function getPushTokenListener() {
  return Notifications.addPushTokenListener(async () => {
    try {
      await syncPushRegistration(false);
    } catch {
      // The next Alerts screen visit retries registration.
    }
  });
}
