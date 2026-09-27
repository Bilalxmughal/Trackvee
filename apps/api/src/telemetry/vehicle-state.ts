export type VehicleLiveStatus = 'moving' | 'idle' | 'parked' | 'offline';

export interface VehicleMotionSample {
  timestamp: Date | string;
  latitude: number;
  longitude: number;
  speedKmh: number;
  ignition: boolean | null;
}

const OFFLINE_AFTER_MS = 10 * 60_000;
const MOVING_ENTER_KMH = 5;
const MOVING_HOLD_KMH = 2;
const MOVING_HOLD_MS = 3 * 60_000;

function distanceMeters(a: VehicleMotionSample, b: VehicleMotionSample): number {
  const r = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * r;
  const dLng = (b.longitude - a.longitude) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * r) * Math.cos(b.latitude * r) * Math.sin(dLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Samples are newest-first. Hold the Moving state through low-speed deceleration;
 * two consecutive low-speed fixes confirm that the vehicle has stopped. */
export function resolveVehicleLiveStatus(samples: VehicleMotionSample[], now = Date.now()): VehicleLiveStatus {
  const latest = samples[0];
  if (!latest) return 'offline';
  const latestMs = new Date(latest.timestamp).getTime();
  if (!Number.isFinite(latestMs) || now - latestMs > OFFLINE_AFTER_MS) return 'offline';
  if (latest.speedKmh >= MOVING_ENTER_KMH) return 'moving';

  const previous = samples[1];
  if (previous) {
    const previousMs = new Date(previous.timestamp).getTime();
    const elapsed = latestMs - previousMs;
    if (elapsed >= 0 && elapsed <= MOVING_HOLD_MS) {
      if (previous.speedKmh >= MOVING_ENTER_KMH && latest.speedKmh > MOVING_HOLD_KMH) return 'moving';
      if (latest.speedKmh <= MOVING_HOLD_KMH && previous.speedKmh <= MOVING_HOLD_KMH) {
        return latest.ignition === true ? 'idle' : 'parked';
      }
    }
  }

  // If the vehicle is crawling below the GPS speed threshold, use consistent
  // displacement across recent valid fixes to distinguish it from GPS jitter.
  const oldest = [...samples].reverse().find(sample => {
    const ms = new Date(sample.timestamp).getTime();
    return Number.isFinite(ms) && latestMs - ms >= 30_000 && latestMs - ms <= MOVING_HOLD_MS;
  });
  if (oldest && latest.speedKmh > MOVING_HOLD_KMH) {
    const elapsedHours = (latestMs - new Date(oldest.timestamp).getTime()) / 3_600_000;
    const derivedSpeedKmh = distanceMeters(oldest, latest) / 1000 / elapsedHours;
    if (distanceMeters(oldest, latest) >= 25 && derivedSpeedKmh >= 2.5 && derivedSpeedKmh <= 160) return 'moving';
  }

  // A single low fix immediately after movement may be GPS/road noise. Keep
  // Moving for that fix; the next low fix confirms Idle/Parked.
  if (previous && latest.speedKmh <= MOVING_HOLD_KMH) {
    const previousMs = new Date(previous.timestamp).getTime();
    if (latestMs - previousMs >= 0 && latestMs - previousMs <= MOVING_HOLD_MS && previous.speedKmh >= MOVING_ENTER_KMH) return 'moving';
  }

  return latest.ignition === true ? 'idle' : 'parked';
}
