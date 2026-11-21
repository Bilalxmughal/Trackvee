import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://api.trackvee.com/api/v1';
const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

type RefreshResult = { status: 'ok'; token: string } | { status: 'expired' } | { status: 'unavailable' };
let refreshRequest: Promise<RefreshResult> | null = null;
let expiredHandler: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  expiredHandler = handler;
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync('yt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(response => response, async (error: AxiosError) => {
  const config = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
  if (error.response?.status !== 401 || !config || config._retry) return Promise.reject(error);
  if (config.url?.includes('/auth/login') || config.url?.includes('/auth/refresh')) return Promise.reject(error);
  config._retry = true;

  if (!refreshRequest) {
    refreshRequest = (async (): Promise<RefreshResult> => {
      const refreshToken = await SecureStore.getItemAsync('yt_refresh');
      if (!refreshToken) return { status: 'expired' };
      try {
        const result = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken }, { timeout: 20000 });
        const nextToken = result.data?.accessToken as string | undefined;
        if (!nextToken) return { status: 'expired' };
        await SecureStore.setItemAsync('yt_token', nextToken);
        if (result.data?.refreshToken) await SecureStore.setItemAsync('yt_refresh', result.data.refreshToken);
        return { status: 'ok', token: nextToken };
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError)) {
          const status = refreshError.response?.status;
          if (!status || status >= 500) return { status: 'unavailable' };
          if (status === 400 || status === 401 || status === 403) return { status: 'expired' };
        }
        return { status: 'unavailable' };
      }
    })().finally(() => { refreshRequest = null; });
  }

  const refresh = await refreshRequest!;
  if (refresh.status === 'unavailable') return Promise.reject(error);
  if (refresh.status === 'expired') {
    await SecureStore.deleteItemAsync('yt_token');
    await SecureStore.deleteItemAsync('yt_refresh');
    await SecureStore.deleteItemAsync('yt_user');
    expiredHandler?.();
    return Promise.reject(error);
  }
  config.headers.Authorization = `Bearer ${refresh.token}`;
  return api(config);
});

export default api;
