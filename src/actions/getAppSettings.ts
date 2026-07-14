'use server';

/**
 * getAppSettings — server action
 *
 * Reads branding / tenant settings from TenantSettings on every request so
 * that logo, favicon and brand colours are always the values stored in the
 * database, even after a fresh deployment or container restart.
 *
 * Usage (in a Server Component or layout):
 *   import { getAppSettings } from '@/actions/getAppSettings';
 *   const settings = await getAppSettings();
 */

import { prisma } from '@/lib/prisma';

export interface AppSettings {
  companyName:    string;
  logoUrl:        string | null;
  faviconUrl:     string | null;
  primaryColor:   string;
  secondaryColor: string;
  companyAddress: string | null;
}

const DEFAULTS: AppSettings = {
  companyName:    'HRM Portal',
  logoUrl:        null,
  faviconUrl:     null,
  primaryColor:   '#8b5cf6',
  secondaryColor: '#06b6d4',
  companyAddress: null,
};

export async function getAppSettings(): Promise<AppSettings> {
  // Skip DB during next build (static generation phase)
  if (process.env.SKIP_DB_ON_BUILD === 'true') {
    return DEFAULTS;
  }

  try {
    const row = await prisma.tenantSettings.findFirst();
    if (!row) {
      console.warn('[getAppSettings] No TenantSettings row found — returning defaults');
      return DEFAULTS;
    }

    return {
      companyName:    row.companyName    || DEFAULTS.companyName,
      logoUrl:        row.logoUrl        ?? null,
      faviconUrl:     row.faviconUrl     ?? null,
      primaryColor:   row.primaryColor   || DEFAULTS.primaryColor,
      secondaryColor: row.secondaryColor || DEFAULTS.secondaryColor,
      companyAddress: row.companyAddress ?? null,
    };
  } catch (err) {
    console.error('[getAppSettings] DB error — returning defaults:', err);
    return DEFAULTS;
  }
}
