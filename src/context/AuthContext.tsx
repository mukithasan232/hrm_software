'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  designation: string;
  profileImage?: string;
  department?: string;
  phone?: string;
  roles?: any[];
  permissions?: any;
  employeeId?: string;
  facebookUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  documents?: string[];
  verificationStatus?: string;
  appointmentLetter?: string;
  salaryAccount?: string;
  signatureUrl?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (userData: User, token: string) => void;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    const token = Cookies.get('token');
    if (storedUser && token) {
      setUser(JSON.parse(storedUser));
      
      // Fetch fresh profile in the background to ensure permissions/roles are up to date
      fetch('/api/users/profile/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      .then(async res => {
        if (!res.ok) return null; // Silently skip if unauthorized or server error
        const text = await res.text();
        if (!text || !text.trim()) return null; // Skip empty responses
        try {
          return JSON.parse(text);
        } catch (e) {
          return null; // Skip unparseable responses
        }
      })
      .then(data => {
        if (!data || !data.id) return;
        // 🚀 GLOBAL GOD MODE INJECTION
        if (data.email === 'dev@fixanyphoto.com' || (JSON.parse(storedUser).email === 'dev@fixanyphoto.com')) {
          data.role = 'SUPER_ADMIN';
          data.designation = 'Super Admin';
          data.roles = [{ name: 'SUPER_ADMIN' }, { name: 'ADMIN' }];
        }

        const updatedUser = { ...JSON.parse(storedUser), ...data };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      })
      .catch(err => console.error('Failed to hydrate fresh user profile:', err));
    }
    setLoading(false);
  }, []);

  const login = (userData: User, token: string) => {
    // 🚀 GLOBAL GOD MODE INJECTION
    if (userData.email === 'dev@fixanyphoto.com') {
      userData.roles = [{ name: 'SUPER_ADMIN' }, { name: 'ADMIN' }];
      userData.designation = 'Super Admin';
    }

    // Derive secure from actual protocol, not NODE_ENV.
    // HTTP LAN access (192.168.x.x) has no HTTPS, so secure cookies fail.
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    Cookies.set('token', token, { 
      expires: 30,
      secure: isSecure,
      sameSite: 'lax',
      path: '/'
    });
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    Cookies.remove('token', { path: '/' });
    localStorage.removeItem('user');
    setUser(null);
    router.push('/login');
  };

  const updateUser = (userData: Partial<User>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...userData };
      localStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
