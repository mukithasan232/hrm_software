import { useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export interface Permission {
  moduleName: string;
  canRead: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export function usePermissions() {
  const { user } = useAuth();
  
  // Since we rely entirely on the token/context now, loading is technically always false
  // if `user` is present.
  const loading = false;
  
  const can = useCallback((moduleName: string, action: 'canRead' | 'canCreate' | 'canEdit' | 'canDelete') => {
    const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
    const designName = typeof user?.designation === 'string' ? user.designation : (user?.designation as any)?.name || '';
    const userDesig = designName.toLowerCase().trim();
    
    const hasAdminRole = user?.roles?.some((r: any) => ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim()));

    if (ADMIN_DESIGNATIONS.includes(userDesig) || hasAdminRole) {
      return true;
    }

    // Rely exclusively on the Role permission matrix (RBAC) (legacy fallback)
    if (user?.roles && user.roles.length > 0) {
      for (const role of user.roles) {
        if (role?.permissions && role.permissions[moduleName]) {
          if (role.permissions[moduleName][action] === true) {
            return true;
          }
        }
      }
    }

    // 1. Check user.permissions (which contains merged Designation + Roles + UserOverrides)
    if (user?.permissions && user.permissions[moduleName]) {
      const modPerms = user.permissions[moduleName];
      
      const checkValue = (val: any) => {
        if (val === true) return true;
        if (typeof val === 'string' && val.toLowerCase() !== 'no' && val.toLowerCase() !== 'not-set' && val.toLowerCase() !== 'not set') {
          return true;
        }
        return false;
      };

      if (action === 'canRead' && (checkValue(modPerms.Read) || checkValue(modPerms.Access) || checkValue(modPerms.canRead))) return true;
      if (action === 'canCreate' && (checkValue(modPerms.Create) || checkValue(modPerms.canCreate))) return true;
      if (action === 'canEdit' && (checkValue(modPerms.Edit) || checkValue(modPerms.canEdit))) return true;
      if (action === 'canDelete' && (checkValue(modPerms.Delete) || checkValue(modPerms.canDelete))) return true;
    }

    return false;
  }, [user]);

  // For backwards compatibility we still expose `permissions` as an empty array or derived array
  // but most components should rely solely on the `can()` function.
  const role = user?.roles?.[0]?.name || null;
  const permissions: Permission[] = [];

  return { permissions, role, loading, can };
}
