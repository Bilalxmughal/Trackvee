import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';

export function useIsOffline() {
  const [offline, setOffline] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const isOffline = state.isConnected === false;
      if (!initialized.current) {
        initialized.current = true;
        setOffline(isOffline);
        return;
      }
      setOffline(isOffline);
    });
    return () => unsub();
  }, []);

  return offline;
}
