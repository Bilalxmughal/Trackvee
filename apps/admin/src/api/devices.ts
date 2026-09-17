import api from './client';

export interface Device {
  id: string;
  displayId: number;
  imei: string;
  name: string | null;
  simNumber: string | null;
  status: 'active' | 'inactive' | 'unassigned' | 'offline';
  vehicleId: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export const devicesApi = {
  list: () => api.get<Device[]>('/devices'),
  get: (id: string) => api.get<Device>(`/devices/${id}`),
  create: (data: Partial<Device>) => api.post<Device>('/devices', data),
  update: (id: string, data: Partial<Device>) => api.patch<Device>(`/devices/${id}`, data),
};
