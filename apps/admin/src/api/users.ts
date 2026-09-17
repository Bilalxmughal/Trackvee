import api from './client';

export interface User {
  id: string;
  displayId: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  organizationId: string | null;
  isActive: boolean;
  createdAt: string;
}

export const usersApi = {
  list: () => api.get<User[]>('/users'),
  get: (id: string) => api.get<User>(`/users/${id}`),
};
