import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ToasterProvider } from '@/components/ToasterProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { BrandProvider } from '@/context/BrandContext';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'HRM & Payroll Portal',
  description: 'Manage attendance and payroll seamlessly.',
};

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
    const settings = await prisma.tenantSettings.findFirst();
    if (settings) {
      if (settings.primaryColor) primaryColor = settings.primaryColor;
      if (settings.secondaryColor) secondaryColor = settings.secondaryColor;
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
    <html lang="en" suppressHydrationWarning>
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
