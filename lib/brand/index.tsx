'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { BrandProfile, Mode } from '@/types';

interface BrandContextValue {
  mode: Mode;
  setMode: (mode: Mode) => void;
  brand: BrandProfile | null;
  personalBrand: BrandProfile | null;
  agencyBrand: BrandProfile | null;
  loading: boolean;
  refreshBrand: () => Promise<void>;
}

const BrandContext = createContext<BrandContextValue | undefined>(undefined);

export function BrandProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const initialMode: Mode = pathname.includes('/agency') ? 'agency' : 'personal';

  const [mode, setMode] = useState<Mode>(initialMode);
  const [personalBrand, setPersonalBrand] = useState<BrandProfile | null>(null);
  const [agencyBrand, setAgencyBrand] = useState<BrandProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('brand_profiles')
        .select('*')
        .eq('user_id', user.id);

      if (data) {
        const personal = data.find((b) => b.mode === 'personal') as BrandProfile | undefined;
        const agency = data.find((b) => b.mode === 'agency') as BrandProfile | undefined;
        setPersonalBrand(personal ?? null);
        setAgencyBrand(agency ?? null);
      }
    } catch (error) {
      console.error('Failed to fetch brand profiles:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const brand = mode === 'personal' ? personalBrand : agencyBrand;

  return (
    <BrandContext.Provider
      value={{
        mode,
        setMode,
        brand,
        personalBrand,
        agencyBrand,
        loading,
        refreshBrand: fetchBrands,
      }}
    >
      {children}
    </BrandContext.Provider>
  );
}

export function useBrand() {
  const context = useContext(BrandContext);
  if (!context) {
    throw new Error('useBrand must be used within a BrandProvider');
  }
  return context;
}

export function useMode(): [Mode, (mode: Mode) => void] {
  const { mode, setMode } = useBrand();
  return [mode, setMode];
}
