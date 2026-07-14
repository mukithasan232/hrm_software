import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ToasterProvider } from '@/components/ToasterProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { BrandProvider } from '@/context/BrandContext';
import { getAppSettings } from '@/actions/getAppSettings';

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getAppSettings();

  return {
    title: settings.companyName,
    description: 'Manage attendance and payroll seamlessly.',
    icons: {
      icon: settings.faviconUrl || '/favicon.ico',
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
  const settings = await getAppSettings();
  const primaryColor   = settings.primaryColor;
  const secondaryColor = settings.secondaryColor;

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
