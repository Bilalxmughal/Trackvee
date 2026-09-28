import Svg, { Circle, Path, Rect } from 'react-native-svg';

const PATHS: Record<string, string[]> = {
  map: ['M9 18l-6 3V6l6-3m0 15l6 3m-6-3V3m6 18l6-3V3l-6 3m0 15V6m0 0L9 3'],
  truck: ['M3 7h11v10H3z', 'M14 10h4l3 3v4h-7z', 'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4', 'M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  report: ['M4 19V5', 'M4 19h17', 'M8 16v-4', 'M13 16V7', 'M18 16v-7'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  'more-vertical': ['M12 5h.01', 'M12 12h.01', 'M12 19h.01'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  down: ['m6 9 6 6 6-6'],
  back: ['m15 18-6-6 6-6', 'M9 12h11'],
  'track-back': ['M6 5v14', 'm19 5-10 7 10 7V5z'],
  'track-forward': ['M18 5v14', 'm5 5 10 7-10 7V5z'],
  forward: ['m9 18 6-6-6-6', 'M15 12h6'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16', 'm21 21-4.35-4.35'],
  locate: ['M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  follow: ['M3 11l18-8-8 18-2-8-8-2z', 'M11 13l10-10'],
  replay: ['M4 11a8 8 0 1 1 2.2 6', 'M4 4v7h7', 'M12 7v5l3 2'],
  play: ['m8 5 11 7-11 7V5z'],
  pause: ['M8 5v14', 'M16 5v14'],
  layers: ['m12 2 9 5-9 5-9-5 9-5z', 'm3 12 9 5 9-5', 'm3 17 9 5 9-5'],
  plus: ['M12 5v14', 'M5 12h14'],
  check: ['m5 12 4 4L19 6'],
  minus: ['M5 12h14'],
  edit: ['M12 20h9', 'M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'm19 6-1 14H6L5 6', 'M10 11v5', 'M14 11v5'],
  geofence: ['M4 5h5l3-2 3 3 5 1v8l-4 1-2 5-5-2-5 1z', 'M4 5v16', 'm4 21 5-1 5 2 2-5 4-1'],
  activity: ['M3 12h4l3-8 4 16 3-8h4'],
  'alert-triangle': ['m10.3 3.9-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3.1l-8-14a2 2 0 0 0-3.4 0Z', 'M12 9v4', 'M12 17h.01'],
  gauge: ['M12 14l4-4', 'M3.3 13a9 9 0 1 1 17.4 0', 'M12 12h.01'],
  rotate: ['M20 7v5h-5', 'M4 17v-5h5', 'M5.6 9a7 7 0 0 1 11.6-2L20 12', 'M4 12l2.8 5a7 7 0 0 0 11.6-2'],
  'arrow-right': ['M5 12h14', 'm13 6 6 6-6 6'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6'],
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M5.6 9a7 7 0 0 1 11.6-2L20 12', 'M4 12l2.8 5a7 7 0 0 0 11.6-2'],
  engine: ['M3 10h3l2-3h7l2 3h3v8h-3l-2 3H8l-2-3H3z', 'M9 10v3h5v-3', 'M6 5V3', 'M18 5V3'],
  power: ['M12 2v10', 'M5.6 5.6a9 9 0 1 0 12.8 0'],
  'map-pin': ['M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0', 'M12 10h.01'],
  battery: ['M6 7h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 'M22 11v4', 'M8 10v6', 'M12 10v6'],
  signal: ['M3 20h2', 'M7 20v-4', 'M12 20v-9', 'M17 20V6', 'M22 20V3'],
};

export function TablerIcon({ name, size = 22, color = '#111827', strokeWidth = 1.8 }: { name: string; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {(PATHS[name] ?? []).map((d, index) => <Path key={index} d={d} />)}
      {name === 'search' && <Circle cx="11" cy="11" r="8" opacity={0} />}
      {name === 'vehicles' && <Rect x="3" y="7" width="18" height="11" rx="2" />}
    </Svg>
  );
}
