'use client';
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/services/api';

// ── types ─────────────────────────────────────────────────────────────────────

export interface BrandSettings {
  companyName:    string;
  logoUrl:        string | null;
  faviconUrl:     string | null;
  primaryColor:   string;
  secondaryColor: string;
  updatedAt?:     string | null;
}

interface BrandContextValue {
  brand:       BrandSettings;
  isLoading:   boolean;
  refreshBrand: () => void;
}

// ── defaults ──────────────────────────────────────────────────────────────────

const DEFAULTS: BrandSettings = {
  companyName:    'HRM Portal',
  logoUrl:        null,
  faviconUrl:     null,
  primaryColor:   '#8b5cf6',
  secondaryColor: '#06b6d4',
  updatedAt:      null,
};

// ── context ───────────────────────────────────────────────────────────────────

const BrandContext = createContext<BrandContextValue>({
  brand:       DEFAULTS,
  isLoading:   true,
  refreshBrand: () => {},
});

export function useBrand() {
  return useContext(BrandContext);
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Converts a hex color (#8b5cf6) to space-separated RGB integers ("139 92 246").
 * Space-separated format is required by Tailwind v4's rgb(var(--x)) opacity pattern.
 */
function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : '139 92 246'; // fallback: violet
}

// ── CSS variable injector ─────────────────────────────────────────────────────

function BrandStyleInjector({ brand }: { brand: BrandSettings }) {
  useEffect(() => {
    const root = document.documentElement;

    // Raw hex — used by inline styles (style={{ color: brand.primaryColor }})
    root.style.setProperty('--brand-primary',   brand.primaryColor);
    root.style.setProperty('--brand-secondary', brand.secondaryColor);

    // Space-separated RGB — used by Tailwind v4 utility classes:
    //   bg-brand-primary, text-brand-secondary, bg-brand-primary/10, etc.
    root.style.setProperty('--brand-primary-rgb',   hexToRgb(brand.primaryColor));
    root.style.setProperty('--brand-secondary-rgb', hexToRgb(brand.secondaryColor));
  }, [brand.primaryColor, brand.secondaryColor]);

  return null;
}

// ── provider ──────────────────────────────────────────────────────────────────

export function BrandProvider({ children }: { children: React.ReactNode }) {
  const [brand, setBrand]       = useState<BrandSettings>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);

  const fetchBrand = useCallback(() => {
    api.get('/settings/appearance')
      .then(res => {
        setBrand({
          companyName:    res.data.companyName    || DEFAULTS.companyName,
          logoUrl:        res.data.logoUrl        || null,
          faviconUrl:     res.data.faviconUrl     || null,
          primaryColor:   res.data.primaryColor   || DEFAULTS.primaryColor,
          secondaryColor: res.data.secondaryColor || DEFAULTS.secondaryColor,
          updatedAt:      res.data.updatedAt      || null,
        });
      })
      .catch(() => { /* silent — keep defaults */ })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => { fetchBrand(); }, [fetchBrand]);

  return (
    <BrandContext.Provider value={{ brand, isLoading, refreshBrand: fetchBrand }}>
      <BrandStyleInjector brand={brand} />
      {children}
    </BrandContext.Provider>
  );
}
