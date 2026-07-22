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
    // 👑 SUPER ADMIN BYPASS
    const u = user as any;
    if (
      u?.userType === 'SUPER_ADMIN' ||
      u?.userType === 'ADMIN' ||
      String(u?.designation?.name || u?.designation || '').toLowerCase().includes('super admin')
    ) {
      return true;
    }

    // Rely exclusively on the Role permission matrix (RBAC) (legacy fallback)
    if (user?.roles && user.roles.length > 0) {
      for (const role of user.roles) {
        if (role?.permissions) {
          const roleKey = Object.keys(role.permissions).find(k => k.toLowerCase() === moduleName.toLowerCase());
          if (roleKey && role.permissions[roleKey][action] === true) {
            return true;
          }
        }
      }
    }

    // 1. Check user.permissions (which contains merged Designation + Roles + UserOverrides)
    if (user?.permissions) {
      const exactKey = Object.keys(user.permissions).find(k => k.toLowerCase() === moduleName.toLowerCase());
      if (exactKey) {
        const modPerms = user.permissions[exactKey];
        
        const checkValue = (val: any) => {
          if (val === true) return true;
          if (typeof val === 'string' && val.toLowerCase() !== 'no' && val.toLowerCase() !== 'not-set' && val.toLowerCase() !== 'not set') {
            return true;
          }
          return false;
        };

        if (action === 'canRead' && (checkValue(modPerms.Read) || checkValue(modPerms.read) || checkValue(modPerms.Access) || checkValue(modPerms.access) || checkValue(modPerms.canRead) || checkValue(modPerms.view))) return true;
        if (action === 'canCreate' && (checkValue(modPerms.Create) || checkValue(modPerms.create) || checkValue(modPerms.canCreate))) return true;
        if (action === 'canEdit' && (checkValue(modPerms.Edit) || checkValue(modPerms.edit) || checkValue(modPerms.canEdit))) return true;
        if (action === 'canDelete' && (checkValue(modPerms.Delete) || checkValue(modPerms.delete) || checkValue(modPerms.canDelete))) return true;
      }
    }

    return false;
  }, [user]);

  /**
   * Returns the explicit RBAC scope string for a module+action: 'No'|'Own'|'Department'|'All'.
   * Admins always get 'All'. Falls back to 'No' if no permission found.
   */
  const scope = useCallback((moduleName: string, action: 'canRead' | 'canCreate' | 'canEdit' | 'canDelete'): 'No' | 'Own' | 'Department' | 'All' => {
    // 👑 SUPER ADMIN BYPASS
    const u = user as any;
    if (
      u?.userType === 'SUPER_ADMIN' ||
      u?.userType === 'ADMIN' ||
      String(u?.designation?.name || u?.designation || '').toLowerCase().includes('super admin')
    ) {
      return 'All';
    }

    const actionMap: Record<string, string> = { canRead: 'Read', canCreate: 'Create', canEdit: 'Edit', canDelete: 'Delete' };
    const jsonAction = actionMap[action] || action;

    if (user?.permissions) {
      const exactKey = Object.keys(user.permissions).find(k => k.toLowerCase() === moduleName.toLowerCase());
      if (exactKey) {
        const modPerms = user.permissions[exactKey];
        const val = modPerms[jsonAction] || modPerms[action] || modPerms[jsonAction.toLowerCase()];
        if (typeof val === 'string') {
          const lower = val.toLowerCase().trim();
          if (lower === 'all') return 'All';
          if (lower === 'department') return 'Department';
          if (lower === 'own') return 'Own';
          if (lower === 'yes' || lower === 'enabled') return 'Own';
          return 'No';
        }
        if (val === true) return 'Own';
        // Fallback: check Access for canRead
        if (action === 'canRead') {
          const accessVal = modPerms.Access || modPerms.access || modPerms.canRead || modPerms.view || modPerms.read;
          if (accessVal === true) return 'Own';
          if (typeof accessVal === 'string') {
            const lA = accessVal.toLowerCase().trim();
            if (lA === 'enabled' || lA === 'yes') return 'Own';
          }
        }
      }
    }

    return 'No';
  }, [user]);

  // For backwards compatibility we still expose `permissions` as an empty array or derived array
  // but most components should rely solely on the `can()` function.
  const role = user?.roles?.[0]?.name || null;
  const permissions: Permission[] = [];

  return { permissions, role, loading, can, scope };
}
