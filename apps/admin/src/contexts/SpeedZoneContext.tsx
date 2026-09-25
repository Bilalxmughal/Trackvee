import { createContext, useContext, useState } from 'react';

interface SpeedZoneCtx {
  szPanelOpen: boolean;
  openSzPanel: () => void;
  closeSzPanel: () => void;
  szCount: number;
  setSzCount: (n: number) => void;
}

const Ctx = createContext<SpeedZoneCtx>({
  szPanelOpen: false, openSzPanel: () => {}, closeSzPanel: () => {},
  szCount: 0, setSzCount: () => {},
});

export const useSpeedZone = () => useContext(Ctx);

export function SpeedZoneProvider({ children }: { children: React.ReactNode }) {
  const [szPanelOpen, setSzPanelOpen] = useState(false);
  const [szCount, setSzCount] = useState(0);
  return (
    <Ctx.Provider value={{
      szPanelOpen,
      openSzPanel: () => setSzPanelOpen(true),
      closeSzPanel: () => setSzPanelOpen(false),
      szCount, setSzCount,
    }}>
      {children}
    </Ctx.Provider>
  );
}
