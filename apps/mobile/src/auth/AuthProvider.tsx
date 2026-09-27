import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import api, { setSessionExpiredHandler } from '../lib/api';

export interface MobileUser {
  id: string;
  displayId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  organizationId: string | null;
  organizationName?: string | null;
}

const CLIENT_ROLES = new Set(['client_owner', 'client_super_admin', 'client_admin', 'client_user']);
interface AuthValue {
  user: MobileUser | null;
  loading: boolean;
  sessionRestoreFailed: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: React.PropsWithChildren) {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionRestoreFailed, setSessionRestoreFailed] = useState(false);

  const logout = useCallback(async () => {
    await SecureStore.deleteItemAsync('yt_token');
    await SecureStore.deleteItemAsync('yt_refresh');
    await SecureStore.deleteItemAsync('yt_user');
    setUser(null);
    setSessionRestoreFailed(false);
  }, []);

  useEffect(() => {
    setSessionExpiredHandler(() => setUser(null));
    let mounted = true;
    (async () => {
      const token = await SecureStore.getItemAsync('yt_token');
      if (!token) { if (mounted) setLoading(false); return; }
      const cachedUserText = await SecureStore.getItemAsync('yt_user');
      let cachedUser: MobileUser | null = null;
      try {
        const parsed = cachedUserText ? JSON.parse(cachedUserText) as MobileUser : null;
        if (parsed && CLIENT_ROLES.has(parsed.role) && typeof parsed.id === 'string') cachedUser = parsed;
      } catch { cachedUser = null; }
      if (mounted && cachedUser) {
        setUser(cachedUser);
        setLoading(false);
      }
      try {
        const response = await api.get<MobileUser>('/auth/me');
        if (mounted && CLIENT_ROLES.has(response.data.role)) {
          setUser(response.data);
          setSessionRestoreFailed(false);
          await SecureStore.setItemAsync('yt_user', JSON.stringify(response.data));
        }
        else if (mounted) await logout();
      } catch {
        const tokenStillExists = await SecureStore.getItemAsync('yt_token');
        if (mounted && tokenStillExists && !cachedUser) setSessionRestoreFailed(true);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; setSessionExpiredHandler(null); };
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{ accessToken: string; refreshToken: string; user: MobileUser }>('/auth/login', { email, password });
    if (!CLIENT_ROLES.has(response.data.user.role)) throw new Error('Invalid email or password');
    await SecureStore.setItemAsync('yt_token', response.data.accessToken);
    if (response.data.refreshToken) await SecureStore.setItemAsync('yt_refresh', response.data.refreshToken);
    await SecureStore.setItemAsync('yt_user', JSON.stringify(response.data.user));
    setUser(response.data.user);
    setSessionRestoreFailed(false);
  }, []);

  const value = useMemo(() => ({ user, loading, sessionRestoreFailed, login, logout }), [user, loading, sessionRestoreFailed, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
