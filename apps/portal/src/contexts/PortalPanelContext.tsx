import { createContext, useContext, useState, ReactNode } from 'react';

export type PanelType = 'alerts' | 'geofences' | 'pois' | 'reports' | null;

interface PortalPanelCtx {
  activePanel: PanelType;
  openPanel: (p: PanelType) => void;
  closePanel: () => void;
  alertCount: number;
  setAlertCount: (n: number) => void;
}

const Ctx = createContext<PortalPanelCtx>({
  activePanel: null, openPanel: () => {}, closePanel: () => {},
  alertCount: 0, setAlertCount: () => {},
});

export function PortalPanelProvider({ children }: { children: ReactNode }) {
  const [activePanel, setActivePanel] = useState<PanelType>(null);
  const [alertCount, setAlertCount] = useState(0);
  const openPanel = (p: PanelType) => setActivePanel(prev => prev === p ? null : p);
  const closePanel = () => setActivePanel(null);
  return (
    <Ctx.Provider value={{ activePanel, openPanel, closePanel, alertCount, setAlertCount }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePortalPanel() { return useContext(Ctx); }
