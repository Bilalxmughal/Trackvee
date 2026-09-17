import { api } from './client';

export interface Organization {
  id: string;
  displayId: number;
  name: string;
  slug: string;
  ownerId: string;
  isActive: boolean;
  createdAt: string;
}

export const orgsApi = {
  list: () => api.get<Organization[]>('/organizations'),
  get: (id: string) => api.get<Organization>(`/organizations/${id}`),
  create: (data: Partial<Organization>) => api.post<Organization>('/organizations', data),
  update: (id: string, data: Partial<Organization>) =>
    api.patch<Organization>(`/organizations/${id}`, data),
};
