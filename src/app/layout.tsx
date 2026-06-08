import type { Metadata } from 'next';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { LanguageProvider } from '@/context/LanguageContext';
import { Toaster } from 'react-hot-toast';
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
                <Toaster 
                  position="top-right"
                containerStyle={{
                  top: 80,
                  right: 16,
                  zIndex: 99999,
                }}
                toastOptions={{
                  style: {
                    background: '#1e293b',
                    color: '#fff',
                    border: '1px solid #334155',
                  },
                }} 
              />
              </BrandProvider>
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
