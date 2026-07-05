import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const BrandContext = createContext();

export const BrandProvider = ({ children }) => {
  // Persist selected brand ID in sessionStorage so it survives page navigations
  // but resets when the browser tab is closed (avoids stale state across logins).
  const [selectedBrandId, setSelectedBrandIdRaw] = useState(() => {
    const stored = sessionStorage.getItem('selectedBrandId');
    return stored ? parseInt(stored, 10) : null;
  });

  const [brands, setBrands] = useState([]);
  const [brandsLoading, setBrandsLoading] = useState(true);

  // Load all brands once on mount (after login resolves, AuthProvider renders children)
  const refreshBrands = () => {
    return api.get('/brands/')
      .then(res => {
        const list = res.data || [];
        setBrands(list);

        // Auto-select: keep existing selection if still valid, else pick first
        setSelectedBrandIdRaw(prev => {
          const stillExists = list.find(b => b.id === prev);
          const newId = stillExists ? prev : (list[0]?.id ?? null);
          if (newId) sessionStorage.setItem('selectedBrandId', String(newId));
          else sessionStorage.removeItem('selectedBrandId');
          return newId;
        });

        return list;
      })
      .catch(() => {
        setBrands([]);
        return [];
      })
      .finally(() => setBrandsLoading(false));
  };

  useEffect(() => { refreshBrands(); }, []);

  const setSelectedBrandId = (id) => {
    setSelectedBrandIdRaw(id);
    if (id != null) sessionStorage.setItem('selectedBrandId', String(id));
    else sessionStorage.removeItem('selectedBrandId');
  };

  const selectedBrand = brands.find(b => b.id === selectedBrandId) ?? null;

  return (
    <BrandContext.Provider value={{ brands, setBrands, brandsLoading, refreshBrands, selectedBrandId, setSelectedBrandId, selectedBrand }}>
      {children}
    </BrandContext.Provider>
  );
};

export const useBrand = () => useContext(BrandContext);
