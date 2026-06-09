import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { ToasterProvider } from '@/components/ToasterProvider';
import { ThemeProvider } from '@/components/ThemeProvider';
import { BrandProvider } from '@/context/BrandContext';

export const metadata: Metadata = {
  title: 'HRM & Payroll Portal',
  description: 'Manage attendance and payroll seamlessly.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased" suppressHydrationWarning>
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
