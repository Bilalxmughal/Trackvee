export const lightTheme = {
  red: '#dc2626',
  ink: '#111827',
  secondary: '#6b7280',
  muted: '#9ca3af',
  border: '#e5e7eb',
  border2: '#f3f4f6',
  surface: '#ffffff',
  canvas: '#f8fafc',
  bg: '#ffffff',
  bg2: '#f8fafc',
  card: '#ffffff',
  cardBorder: '#e5e7eb',
  chipBg: '#f1f5f9',
  moving: '#16a34a',
  idle: '#f59e0b',
  offline: '#9ca3af',
  inputBg: '#f8fafc',
};

export const darkTheme = {
  red: '#ef4444',
  ink: '#f9fafb',
  secondary: '#9ca3af',
  muted: '#6b7280',
  border: '#2a3441',
  border2: '#1a2230',
  surface: '#1f2937',
  canvas: '#111827',
  bg: '#111827',
  bg2: '#1f2937',
  card: '#1f2937',
  cardBorder: '#374151',
  chipBg: '#374151',
  moving: '#22c55e',
  idle: '#f59e0b',
  offline: '#6b7280',
  inputBg: '#1f2937',
};

export type AppTheme = typeof lightTheme;
// backward-compat default
export const theme = lightTheme;
