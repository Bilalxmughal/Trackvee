import { createContext, useContext, useState, useCallback } from 'react';

interface POICtx {
  poiPanelOpen: boolean;
  openPoiPanel: () => void;
  closePoiPanel: () => void;
  poiCount: number;
  setPoiCount: (n: number) => void;
  pickingLocation: boolean;
  setPickingLocation: (b: boolean) => void;
  pendingCoords: [number, number] | null;
  setPendingCoords: (c: [number, number] | null) => void;
}

const Ctx = createContext<POICtx>({
  poiPanelOpen: false, openPoiPanel: () => {}, closePoiPanel: () => {},
  poiCount: 0, setPoiCount: () => {},
  pickingLocation: false, setPickingLocation: () => {},
  pendingCoords: null, setPendingCoords: () => {},
});

export const usePOI = () => useContext(Ctx);

export function POIProvider({ children }: { children: React.ReactNode }) {
  const [poiPanelOpen, setPoiPanelOpen] = useState(false);
  const [poiCount, setPoiCount] = useState(0);
  const [pickingLocation, setPickingLocation] = useState(false);
  const [pendingCoords, setPendingCoords] = useState<[number, number] | null>(null);

  const openPoiPanel = useCallback(() => setPoiPanelOpen(true), []);
  const closePoiPanel = useCallback(() => setPoiPanelOpen(false), []);

  return (
    <Ctx.Provider value={{
      poiPanelOpen, openPoiPanel, closePoiPanel,
      poiCount, setPoiCount,
      pickingLocation, setPickingLocation,
      pendingCoords, setPendingCoords,
    }}>
      {children}
    </Ctx.Provider>
  );
}
