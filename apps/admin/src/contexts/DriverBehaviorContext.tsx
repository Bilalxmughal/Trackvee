import { createContext, useContext, useState } from 'react';

interface DbCtx {
  dbPanelOpen: boolean;
  openDbPanel: () => void;
  closeDbPanel: () => void;
}

const Ctx = createContext<DbCtx>({ dbPanelOpen: false, openDbPanel: () => {}, closeDbPanel: () => {} });

export const useDriverBehaviorPanel = () => useContext(Ctx);

export function DriverBehaviorPanelProvider({ children }: { children: React.ReactNode }) {
  const [dbPanelOpen, setDbPanelOpen] = useState(false);
  return (
    <Ctx.Provider value={{ dbPanelOpen, openDbPanel: () => setDbPanelOpen(true), closeDbPanel: () => setDbPanelOpen(false) }}>
      {children}
    </Ctx.Provider>
  );
}
