import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/services/api';

export interface Permission {
  moduleName: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions([]);
      setRole(null);
      setLoading(false);
      return;
    }

    try {
      const res = await api.get('/auth/permissions');
      setPermissions(res.data.permissions || []);
      setRole(res.data.role);
    } catch (err) {
      console.error('Failed to fetch permissions', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Actually, in this project, api requests might need the token explicitly if it's not intercepted.
    // Let's rely on standard fetch which passes cookies, or use an existing api helper if available.
    fetchPermissions();
  }, [fetchPermissions]);

  const can = useCallback((moduleName: string, action: 'canRead' | 'canCreate' | 'canEdit' | 'canDelete') => {
    const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
    const designName = typeof user?.designation === 'string' ? user.designation : (user?.designation as any)?.name || '';
    const userDesig = designName.toLowerCase().trim();
    
    if (ADMIN_DESIGNATIONS.includes(userDesig)) {
      return true;
    }

    const perm = permissions.find(p => p.moduleName === moduleName);
    if (!perm) return false;
    return !!perm[action];
  }, [permissions, user]);

  return { permissions, role, loading, can };
}
