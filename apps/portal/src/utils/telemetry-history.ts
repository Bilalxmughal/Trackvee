import api from '../api/client';

const HISTORY_PAGE_SIZE = 2000;

export type HistoryFix = { latitude: number; longitude: number; timestamp: string; speedKmh: number; gpsValid: boolean; ignition?: boolean | null };

export function isUsableHistoryPoint<T extends HistoryFix>(point: T): boolean {
  return point.gpsValid && Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
    && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180
    && (point.latitude !== 0 || point.longitude !== 0);
}

export function isHistoryDataGap(previous: HistoryFix, next: HistoryFix): boolean {
  const gapSeconds = (new Date(next.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000;
  return !Number.isFinite(gapSeconds) || gapSeconds > 600;
}

export function canContinueHistorySegment(previous: HistoryFix, next: HistoryFix, type: 'parked' | 'idle' | 'driving'): boolean {
  const gapSeconds = (new Date(next.timestamp).getTime() - new Date(previous.timestamp).getTime()) / 1000;
  if (!Number.isFinite(gapSeconds) || gapSeconds < 0) return false;
  const rad = Math.PI / 180;
  const dLat = (next.latitude - previous.latitude) * rad;
  const dLng = (next.longitude - previous.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(previous.latitude * rad) * Math.cos(next.latitude * rad) * Math.sin(dLng / 2) ** 2;
  const distanceMeters = 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  if (gapSeconds > 600) return false;
  if (type === 'parked') return distanceMeters <= 100;
  return gapSeconds <= 600;
}

export async function fetchTelemetryHistory<T>(imei: string, from: string, to: string): Promise<T[]> {
  const points: T[] = [];
  for (let offset = 0; ; offset += HISTORY_PAGE_SIZE) {
    const { data } = await api.get<T[]>(`/telemetry/${encodeURIComponent(imei)}/history`, {
      params: { from, to, limit: String(HISTORY_PAGE_SIZE), offset: String(offset) },
    });
    points.push(...data);
    if (data.length < HISTORY_PAGE_SIZE) return points;
  }
}
