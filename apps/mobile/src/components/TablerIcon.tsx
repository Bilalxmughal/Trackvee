import Svg, { Circle, Path, Rect } from 'react-native-svg';

const PATHS: Record<string, string[]> = {
  map: ['M9 18l-6 3V6l6-3m0 15l6 3m-6-3V3m6 18l6-3V3l-6 3m0 15V6m0 0L9 3'],
  truck: ['M3 7h11v10H3z', 'M14 10h4l3 3v4h-7z', 'M7 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4', 'M18 20a2 2 0 1 0 0-4 2 2 0 0 0 0 4'],
  bell: ['M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4'],
  report: ['M4 19V5', 'M4 19h17', 'M8 16v-4', 'M13 16V7', 'M18 16v-7'],
  more: ['M5 12h.01', 'M12 12h.01', 'M19 12h.01'],
  close: ['M18 6 6 18', 'm6 6 12 12'],
  back: ['m15 18-6-6 6-6', 'M9 12h11'],
  search: ['M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16', 'm21 21-4.35-4.35'],
  locate: ['M12 2v3', 'M12 19v3', 'M2 12h3', 'M19 12h3', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  plus: ['M12 5v14', 'M5 12h14'],
  user: ['M20 21a8 8 0 0 0-16 0', 'M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M12 3h6a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3h-6'],
  refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M5.6 9a7 7 0 0 1 11.6-2L20 12', 'M4 12l2.8 5a7 7 0 0 0 11.6-2'],
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
