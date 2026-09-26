import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

const api = axios.create({ baseURL: BASE, timeout: 20000 });

function getToken() {
  return localStorage.getItem('yt_token') || sessionStorage.getItem('yt_token');
}
function getRefresh() {
  return localStorage.getItem('yt_refresh') || sessionStorage.getItem('yt_refresh');
}
function clearAuth() {
  localStorage.removeItem('yt_token');
  localStorage.removeItem('yt_refresh');
  sessionStorage.removeItem('yt_token');
  sessionStorage.removeItem('yt_refresh');
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

let refreshing = false;
type PendingResolver = (token: string | null) => void;
let pending: PendingResolver[] = [];

function drainPending(token: string | null) {
  pending.forEach(resolve => resolve(token));
  pending = [];
}

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config as (typeof err.config & { _retry?: boolean });
    if (err.response?.status === 401 && !cfg?._retry) {
      const rt = getRefresh();
      if (!rt) { clearAuth(); window.location.href = '/login'; return Promise.reject(err); }

      if (refreshing) {
        return new Promise((resolve, reject) => {
          pending.push((newToken) => {
            if (!newToken) { reject(err); return; }
            cfg._retry = true;
            cfg.headers = cfg.headers ?? {};
            cfg.headers.Authorization = `Bearer ${newToken}`;
            resolve(api(cfg));
          });
        });
      }

      refreshing = true;
      cfg._retry = true;
      try {
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: rt });
        const inLocal = !!localStorage.getItem('yt_refresh');
        (inLocal ? localStorage : sessionStorage).setItem('yt_token', data.accessToken);
        cfg.headers = cfg.headers ?? {};
        cfg.headers.Authorization = `Bearer ${data.accessToken}`;
        drainPending(data.accessToken);
        refreshing = false;
        return api(cfg);
      } catch {
        refreshing = false;
        drainPending(null);
        clearAuth();
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  },
);

export default api;
