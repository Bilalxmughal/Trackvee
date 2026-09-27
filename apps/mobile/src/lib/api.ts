import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'https://portal.trackvee.com/api/v1';
const api = axios.create({ baseURL: API_BASE, timeout: 20000 });

let refreshRequest: Promise<string | null> | null = null;
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
  config._retry = true;

  if (!refreshRequest) {
    refreshRequest = (async () => {
      const refreshToken = await SecureStore.getItemAsync('yt_refresh');
      if (!refreshToken) return null;
      try {
        const result = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken }, { timeout: 20000 });
        const nextToken = result.data?.accessToken as string | undefined;
        if (!nextToken) return null;
        await SecureStore.setItemAsync('yt_token', nextToken);
        if (result.data?.refreshToken) await SecureStore.setItemAsync('yt_refresh', result.data.refreshToken);
        return nextToken;
      } catch {
        return null;
      }
    })().finally(() => { refreshRequest = null; });
  }

  const token = await refreshRequest;
  if (!token) {
    await SecureStore.deleteItemAsync('yt_token');
    await SecureStore.deleteItemAsync('yt_refresh');
    expiredHandler?.();
    return Promise.reject(error);
  }
  config.headers.Authorization = `Bearer ${token}`;
  return api(config);
});

export default api;
