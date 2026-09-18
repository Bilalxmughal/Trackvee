import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

interface City { id: string; name: string; }

interface CityFilterContextType {
  cities: City[];
  selectedCityId: string;
  setSelectedCityId: (id: string) => void;
}

const CityFilterContext = createContext<CityFilterContextType>({
  cities: [],
  selectedCityId: '',
  setSelectedCityId: () => {},
});

export function CityFilterProvider({ children }: { children: React.ReactNode }) {
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCityId, setSelectedCityId] = useState('');

  useEffect(() => {
    api.get<City[]>('/cities').then(r => setCities(r.data)).catch(() => {});
  }, []);

  return (
    <CityFilterContext.Provider value={{ cities, selectedCityId, setSelectedCityId }}>
      {children}
    </CityFilterContext.Provider>
  );
}

export const useCityFilter = () => useContext(CityFilterContext);
