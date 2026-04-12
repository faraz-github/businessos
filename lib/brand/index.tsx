'use client';

import React, {
  createContext, useContext, useState, useEffect, useCallback, type ReactNode,
} from 'react';
import { usePathname } from 'next/navigation';
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

// Safe default — prevents throws during SSR hydration if context is read
// before the provider has mounted. Components should check `loading` before
// relying on brand data.
const defaultValue: BrandContextValue = {
  mode: 'personal',
  setMode: () => {},
  brand: null,
  personalBrand: null,
  agencyBrand: null,
  loading: true,
  refreshBrand: async () => {},
};

const BrandContext = createContext<BrandContextValue>(defaultValue);

export function BrandProvider({ children }: { children: ReactNode }): ReactNode {
  const pathname = usePathname();
  const initialMode: Mode = pathname.includes('/agency') ? 'agency' : 'personal';

  const [mode, setMode]                 = useState<Mode>(initialMode);
  const [personalBrand, setPersonalBrand] = useState<BrandProfile | null>(null);
  const [agencyBrand, setAgencyBrand]   = useState<BrandProfile | null>(null);
  const [loading, setLoading]           = useState(true);

  // Update mode when URL changes (e.g. navigating personal ↔ agency)
  useEffect(() => {
    const derived: Mode = pathname.includes('/agency') ? 'agency' : 'personal';
    setMode(derived);
  }, [pathname]);

  const fetchBrands = useCallback(async () => {
    setLoading(true);
    try {
      // Use API route — browser supabase client can't pass RLS with custom JWT auth
      const res = await fetch('/api/brand');
      if (!res.ok) return;
      const data: BrandProfile[] = await res.json();
      setPersonalBrand(data.find(b => b.mode === 'personal') ?? null);
      setAgencyBrand  (data.find(b => b.mode === 'agency')   ?? null);
    } catch (err) {
      console.error('Failed to fetch brand profiles:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);

  const brand = mode === 'personal' ? personalBrand : agencyBrand;

  return (
    <BrandContext.Provider value={{ mode, setMode, brand, personalBrand, agencyBrand, loading, refreshBrand: fetchBrands }}>
      {children}
    </BrandContext.Provider>
  ) as React.ReactNode;
}

export function useBrand() {
  return useContext(BrandContext);
  // No throw — safe default is provided. Components handle loading state themselves.
}

export function useMode(): [Mode, (mode: Mode) => void] {
  const { mode, setMode } = useBrand();
  return [mode, setMode];
}
