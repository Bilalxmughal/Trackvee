import { createContext, useContext, useState } from 'react';

interface GeofenceCtx {
  gfPanelOpen: boolean;
  openGfPanel: () => void;
  closeGfPanel: () => void;
  gfCount: number;
  setGfCount: (n: number) => void;
}

const Ctx = createContext<GeofenceCtx>({
  gfPanelOpen: false, openGfPanel: () => {}, closeGfPanel: () => {},
  gfCount: 0, setGfCount: () => {},
});

export const useGeofence = () => useContext(Ctx);

export function GeofenceProvider({ children }: { children: React.ReactNode }) {
  const [gfPanelOpen, setGfPanelOpen] = useState(false);
  const [gfCount, setGfCount] = useState(0);
  return (
    <Ctx.Provider value={{
      gfPanelOpen,
      openGfPanel: () => setGfPanelOpen(true),
      closeGfPanel: () => setGfPanelOpen(false),
      gfCount, setGfCount,
    }}>
      {children}
    </Ctx.Provider>
  );
}
