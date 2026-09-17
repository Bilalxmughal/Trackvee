import { api } from './client';

export interface Vehicle {
  id: string;
  displayId: number;
  name: string;
  licensePlate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  type: string;
  ownerId: string;
  organizationId: string | null;
  isActive: boolean;
  createdAt: string;
}

export const vehiclesApi = {
  list: () => api.get<Vehicle[]>('/vehicles'),
  get: (id: string) => api.get<Vehicle>(`/vehicles/${id}`),
  create: (data: Partial<Vehicle>) => api.post<Vehicle>('/vehicles', data),
  update: (id: string, data: Partial<Vehicle>) => api.patch<Vehicle>(`/vehicles/${id}`, data),
  remove: (id: string) => api.delete(`/vehicles/${id}`),
};
