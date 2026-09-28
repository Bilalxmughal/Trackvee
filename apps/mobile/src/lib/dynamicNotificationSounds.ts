import { Directory, File, Paths } from 'expo-file-system';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import api from './api';

export interface DynamicNotificationSound {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  durationMs: number;
  isActive: boolean;
}

interface DynamicSoundsNativeModule {
  installSound(soundId: string, fileName: string, soundName: string, sourceUri: string): Promise<boolean>;
}

const nativeModule = requireOptionalNativeModule<DynamicSoundsNativeModule>('TrackveeDynamicSounds');
const soundDirectory = new Directory(Paths.cache, 'notification-sounds');
const inflight = new Map<string, Promise<{ file: File; installed: boolean }>>();

export function supportsDynamicNotificationSounds(): boolean {
  return !!nativeModule && (Platform.OS === 'ios' || Platform.OS === 'android');
}

export async function getDynamicNotificationSounds(): Promise<DynamicNotificationSound[]> {
  const response = await api.get<DynamicNotificationSound[]>('/alerts/sounds');
  return Array.isArray(response.data) ? response.data.filter(item => item?.isActive && typeof item.id === 'string') : [];
}

export async function cacheDynamicNotificationSound(sound: DynamicNotificationSound): Promise<{ uri: string; installed: boolean }> {
  const result = await ensureSound(sound);
  return { uri: result.file.uri, installed: result.installed };
}

export async function installDynamicNotificationSounds(sounds?: DynamicNotificationSound[]): Promise<string[]> {
  if (!supportsDynamicNotificationSounds()) return [];
  const catalog = sounds ?? await getDynamicNotificationSounds();
  const installed: string[] = [];
  for (const sound of catalog) {
    try {
      const result = await ensureSound(sound);
      if (result.installed) installed.push(sound.id);
    } catch {
      // Keep other tones available if an individual download or platform registration fails.
    }
  }
  return installed;
}

function ensureSound(sound: DynamicNotificationSound): Promise<{ file: File; installed: boolean }> {
  const existing = inflight.get(sound.id);
  if (existing) return existing;
  const request = (async () => {
    soundDirectory.create({ idempotent: true, intermediates: true });
    const file = new File(soundDirectory, sound.fileName);
    if (!file.exists || (file.size ?? 0) === 0) {
      const token = await SecureStore.getItemAsync('yt_token');
      if (!token) throw new Error('Sign in to download notification sounds');
      await File.downloadFileAsync(api.getUri({ url: `/alerts/sounds/${encodeURIComponent(sound.id)}/audio` }), file, {
        headers: { Authorization: `Bearer ${token}` },
        idempotent: true,
      });
    }
    const installed = nativeModule ? await nativeModule.installSound(sound.id, sound.fileName, sound.name, file.uri) : false;
    return { file, installed };
  })().finally(() => inflight.delete(sound.id));
  inflight.set(sound.id, request);
  return request;
}
