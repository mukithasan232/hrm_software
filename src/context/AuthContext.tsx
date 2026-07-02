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
      .then(res => res.json())
      .then(data => {
        if (data && data.id) {
          const updatedUser = { ...JSON.parse(storedUser), ...data };
          localStorage.setItem('user', JSON.stringify(updatedUser));
          setUser(updatedUser);
        }
      })
      .catch(err => console.error('Failed to hydrate fresh user profile:', err));
    }
    setLoading(false);
  }, []);

  const login = (userData: User, token: string) => {
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
