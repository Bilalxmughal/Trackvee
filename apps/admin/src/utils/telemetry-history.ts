import api from '../api/client';

const HISTORY_PAGE_SIZE = 2000;

export async function fetchTelemetryHistory<T>(imei: string, from?: string, to?: string): Promise<T[]> {
  const points: T[] = [];
  for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
    const params: Record<string, string> = { limit: String(HISTORY_PAGE_SIZE), offset: String(offset) };
    if (from) params.from = from;
    if (to) params.to = to;
    const { data } = await api.get<T[]>(`/telemetry/${encodeURIComponent(imei)}/history`, { params });
    points.push(...data);
    if (data.length < HISTORY_PAGE_SIZE) return points;
  }
}
