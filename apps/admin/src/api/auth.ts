import api from './client';

export interface AuthUser {
  id: string;
  displayId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  isActive: boolean;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ accessToken: string; user: AuthUser }>('/auth/login', { email, password }),
  me: () => api.get<AuthUser>('/auth/me'),
};
