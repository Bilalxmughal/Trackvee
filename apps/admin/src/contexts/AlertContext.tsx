import { createContext, useContext, useState, useRef, ReactNode } from 'react';

export interface AlertSettings {
  speedLimit: number;
  idleMinutes: number;
  notifications: boolean;
}

const ALERT_KEY = 'yt_alert_v1';
const DEFAULT_ALERT: AlertSettings = { speedLimit: 80, idleMinutes: 15, notifications: false };

export function loadAlertSettings(): AlertSettings {
  try { return { ...DEFAULT_ALERT, ...JSON.parse(localStorage.getItem(ALERT_KEY) ?? '{}') }; }
  catch { return { ...DEFAULT_ALERT }; }
}
export function saveAlertSettings(s: AlertSettings) {
  try { localStorage.setItem(ALERT_KEY, JSON.stringify(s)); } catch {}
}

interface AlertCtx {
  alertSettings: AlertSettings;
  alertSettingsRef: React.MutableRefObject<AlertSettings>;
  setAlertSettings: (s: AlertSettings) => void;
  activeAlertCount: number;
  setActiveAlertCount: (n: number) => void;
}

const Ctx = createContext<AlertCtx | null>(null);

export function AlertProvider({ children }: { children: ReactNode }) {
  const [alertSettings, _setAlertSettings] = useState<AlertSettings>(loadAlertSettings);
  const alertSettingsRef = useRef<AlertSettings>(alertSettings);
  const [activeAlertCount, setActiveAlertCount] = useState(0);

  const setAlertSettings = (s: AlertSettings) => {
    alertSettingsRef.current = s;
    _setAlertSettings(s);
    saveAlertSettings(s);
  };

  return (
    <Ctx.Provider value={{ alertSettings, alertSettingsRef, setAlertSettings, activeAlertCount, setActiveAlertCount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAlert() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAlert outside AlertProvider');
  return ctx;
}
