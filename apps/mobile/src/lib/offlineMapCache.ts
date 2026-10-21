import * as FileSystem from 'expo-file-system';

const CACHE_DIR = `${FileSystem.cacheDirectory}map-tiles/`;
const MAX_TILES = 2000;
const TILE_TIMEOUT_MS = 8000;

function latToTileY(lat: number, zoom: number): number {
  const latRad = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * Math.pow(2, zoom));
}

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
}

function tileFilePath(z: number, x: number, y: number): string {
  return `${CACHE_DIR}${z}_${x}_${y}.png`;
}

export async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
}

export function localTileUri(z: number, x: number, y: number): string {
  return `file://${tileFilePath(z, x, y).replace('file://', '')}`;
}

export async function isTileCached(z: number, x: number, y: number): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(tileFilePath(z, x, y));
    return info.exists && (info as any).size > 0;
  } catch { return false; }
}

async function downloadTile(z: number, x: number, y: number): Promise<boolean> {
  const url = `https://a.tile.openstreetmap.org/${z}/${x}/${y}.png`;
  const dest = tileFilePath(z, x, y);
  try {
    const res = await FileSystem.downloadAsync(url, dest, { sessionType: FileSystem.FileSystemSessionType.BACKGROUND });
    return res.status === 200;
  } catch { return false; }
}

export interface DownloadProgress { downloaded: number; total: number; failed: number; }

export async function downloadRegion(
  bounds: { north: number; south: number; east: number; west: number },
  minZoom = 12,
  maxZoom = 16,
  onProgress?: (p: DownloadProgress) => void,
  signal?: { cancelled: boolean },
): Promise<DownloadProgress> {
  await ensureCacheDir();

  const tiles: { z: number; x: number; y: number }[] = [];
  for (let z = minZoom; z <= maxZoom; z++) {
    const xMin = lngToTileX(bounds.west, z);
    const xMax = lngToTileX(bounds.east, z);
    const yMin = latToTileY(bounds.north, z);
    const yMax = latToTileY(bounds.south, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        tiles.push({ z, x, y });
      }
    }
  }

  const limited = tiles.slice(0, MAX_TILES);
  let downloaded = 0;
  let failed = 0;

  for (const tile of limited) {
    if (signal?.cancelled) break;
    const cached = await isTileCached(tile.z, tile.x, tile.y);
    if (!cached) {
      const ok = await Promise.race([
        downloadTile(tile.z, tile.x, tile.y),
        new Promise<false>(resolve => setTimeout(() => resolve(false), TILE_TIMEOUT_MS)),
      ]);
      if (ok) downloaded++; else failed++;
    } else { downloaded++; }
    onProgress?.({ downloaded, total: limited.length, failed });
  }

  return { downloaded, total: limited.length, failed };
}

export async function getCacheSize(): Promise<{ count: number; bytes: number }> {
  try {
    await ensureCacheDir();
    const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
    let bytes = 0;
    for (const f of files) {
      const info = await FileSystem.getInfoAsync(`${CACHE_DIR}${f}`);
      if (info.exists) bytes += (info as any).size ?? 0;
    }
    return { count: files.length, bytes };
  } catch { return { count: 0, bytes: 0 }; }
}

export async function clearCache(): Promise<void> {
  try {
    await FileSystem.deleteAsync(CACHE_DIR, { idempotent: true });
  } catch {}
}
