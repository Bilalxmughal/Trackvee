import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AxiosResponse } from 'axios';
import { authApi, AuthUser } from '../api/auth';
import api from '../api/client';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isImpersonating: boolean;
  originalUser: AuthUser | null;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
  loginAs: (userId: string) => Promise<void>;
  exitImpersonation: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getToken() {
  return localStorage.getItem('yt_token') || sessionStorage.getItem('yt_token');
}

function clearAuth() {
  localStorage.removeItem('yt_token');
  localStorage.removeItem('yt_refresh');
  sessionStorage.removeItem('yt_token');
  sessionStorage.removeItem('yt_refresh');
  sessionStorage.removeItem('yt_orig_token');
  sessionStorage.removeItem('yt_orig_refresh');
  sessionStorage.removeItem('yt_impersonating');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [originalUser, setOriginalUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isImpersonating, setIsImpersonating] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    const imp = sessionStorage.getItem('yt_impersonating');
    if (imp) setIsImpersonating(true);
    authApi.me()
      .then((r: AxiosResponse<AuthUser>) => {
        setUser(r.data);
        if (imp) {
          // restore original user info from stored token
          const origToken = sessionStorage.getItem('yt_orig_token');
          if (origToken) {
            // decode without verifying to get user info
            try {
              const payload = JSON.parse(atob(origToken.split('.')[1]));
              setOriginalUser({ id: payload.sub, email: payload.email, role: payload.role, displayId: 0, firstName: null, lastName: null, isActive: true });
            } catch { /* no-op */ }
          }
        }
      })
      .catch(() => clearAuth())
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string, remember = false) => {
    const r = await authApi.login(email, password);
    const store = remember ? localStorage : sessionStorage;
    store.setItem('yt_token', r.data.accessToken);
    if (r.data.refreshToken) store.setItem('yt_refresh', r.data.refreshToken);
    setUser(r.data.user);
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setOriginalUser(null);
    setIsImpersonating(false);
  };

  const loginAs = async (userId: string) => {
    const r = await api.post<{ accessToken: string; user: AuthUser }>(`/auth/impersonate/${userId}`);
    // Save original token
    const origToken = localStorage.getItem('yt_token') || sessionStorage.getItem('yt_token') || '';
    const origRefresh = localStorage.getItem('yt_refresh') || sessionStorage.getItem('yt_refresh') || '';
    sessionStorage.setItem('yt_orig_token', origToken);
    sessionStorage.setItem('yt_orig_refresh', origRefresh);
    sessionStorage.setItem('yt_impersonating', userId);
    // Set impersonation token
    localStorage.setItem('yt_token', r.data.accessToken);
    localStorage.removeItem('yt_refresh');
    setOriginalUser(user);
    setUser(r.data.user);
    setIsImpersonating(true);
  };

  const exitImpersonation = () => {
    const origToken = sessionStorage.getItem('yt_orig_token');
    const origRefresh = sessionStorage.getItem('yt_orig_refresh');
    if (origToken) localStorage.setItem('yt_token', origToken);
    if (origRefresh) localStorage.setItem('yt_refresh', origRefresh);
    sessionStorage.removeItem('yt_orig_token');
    sessionStorage.removeItem('yt_orig_refresh');
    sessionStorage.removeItem('yt_impersonating');
    localStorage.removeItem('yt_token');
    sessionStorage.removeItem('yt_token');
    if (origToken) {
      const store = localStorage;
      store.setItem('yt_token', origToken);
    }
    setUser(originalUser);
    setOriginalUser(null);
    setIsImpersonating(false);
    window.location.reload();
  };

  return (
    <AuthContext.Provider value={{ user, loading, isImpersonating, originalUser, login, logout, loginAs, exitImpersonation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
