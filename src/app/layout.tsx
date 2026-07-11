import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ToasterProvider } from '@/components/ToasterProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { BrandProvider } from '@/context/BrandContext';
import { prisma } from '@/lib/prisma';

export async function generateMetadata(): Promise<Metadata> {
  let faviconUrl = '/favicon.ico';
  let companyName = 'FIX ANY PHOTO';
  try {
    if (process.env.SKIP_DB_ON_BUILD !== 'true') {
      const settings = await prisma.tenantSettings.findFirst();
      if (settings) {
        if (settings.faviconUrl) faviconUrl = settings.faviconUrl;
        if (settings.companyName) companyName = settings.companyName;
      }
    }
  } catch (e) {
    console.error('Failed to fetch initial tenant settings for metadata', e);
  }

  return {
    title: companyName,
    description: 'Manage attendance and payroll seamlessly.',
    icons: {
      icon: faviconUrl,
    },
    other: {
      google: 'notranslate',
    },
  };
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)} ${parseInt(result[2], 16)} ${parseInt(result[3], 16)}`
    : '139 92 246';
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let primaryColor = '#8b5cf6';
  let secondaryColor = '#06b6d4';
  try {
    if (process.env.SKIP_DB_ON_BUILD !== 'true') {
      const settings = await prisma.tenantSettings.findFirst();
      if (settings) {
        if (settings.primaryColor) primaryColor = settings.primaryColor;
        if (settings.secondaryColor) secondaryColor = settings.secondaryColor;
      }
    }
  } catch (e) {
    console.error('Failed to fetch initial tenant settings', e);
  }

  const customStyle = {
    '--brand-primary': primaryColor,
    '--brand-secondary': secondaryColor,
    '--brand-primary-rgb': hexToRgb(primaryColor),
    '--brand-secondary-rgb': hexToRgb(secondaryColor),
  } as React.CSSProperties;

  return (
    <html lang="bn" translate="no" className="notranslate" suppressHydrationWarning>
      <body className="antialiased" style={customStyle} suppressHydrationWarning>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <AuthProvider>
            <LanguageProvider>
              <BrandProvider>
                {children}
                <ToasterProvider />
              </BrandProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
