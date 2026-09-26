import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser } from '../api/auth';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => void;
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
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    authApi.me()
      .then(r => setUser(r.data))
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
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
