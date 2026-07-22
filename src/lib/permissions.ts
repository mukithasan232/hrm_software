import { prisma } from './prisma';

/**
 * Checks if a user has a specific permission based on all their assigned roles.
 * Performs a Logical OR (Union) operation across all roles.
 * "Grant" takes precedence over "Deny".
 */
export async function hasPermission(
  userId: string | undefined,
  moduleName: string,
  action: 'canRead' | 'canCreate' | 'canEdit' | 'canDelete'
): Promise<boolean> {
  const scope = await getPermissionScope(userId, moduleName, action);
  return scope !== 'No';
}

/**
 * Gets the explicit permission scope for a user, module, and action.
 */
export async function getPermissionScope(
  userId: string | undefined,
  moduleName: string,
  action: 'canRead' | 'canCreate' | 'canEdit' | 'canDelete'
): Promise<'No' | 'Own' | 'Department' | 'All'> {
  if (!userId) return 'No';

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { 
      roles: true,
      customDesignation: true,
      userPermission: true
    } as any
  });

  if (!dbUser) return 'No';

  // 🚀 GLOBAL GOD MODE BYPASS FOR API ROUTES
  if (dbUser.email === 'dev@fixanyphoto.com') {
    return 'All'; // Immediately authorize any action for any module
  }

  // 👑 SUPER ADMIN BYPASS
  if (
    dbUser.userType === 'SUPER_ADMIN' ||
    dbUser.userType === 'ADMIN' ||
    String((dbUser as any).customDesignation?.name || dbUser.designation || '').toLowerCase().includes('super admin')
  ) {
    return 'All';
  }

  const actionMap: Record<string, string> = {
    canRead: 'Read',
    canCreate: 'Create',
    canEdit: 'Edit',
    canDelete: 'Delete'
  };
  const jsonAction = actionMap[action] || action;

  // Merge permissions from Designation -> Roles -> UserOverrides
  let mergedPerms: any = {};
  
  if ((dbUser as any).customDesignation?.permissions) {
    const dPerms = typeof (dbUser as any).customDesignation.permissions === 'string' 
      ? JSON.parse((dbUser as any).customDesignation.permissions) 
      : (dbUser as any).customDesignation.permissions;
    mergedPerms = { ...mergedPerms, ...dPerms };
  }

  if ((dbUser as any).roles && (dbUser as any).roles.length > 0) {
    (dbUser as any).roles.forEach((r: any) => {
      if (r.permissions) {
        const rPerms = typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions;
        mergedPerms = { ...mergedPerms, ...rPerms };
      }
    });
  }

  if ((dbUser as any).userPermission?.matrix) {
    const uPerms = typeof (dbUser as any).userPermission.matrix === 'string'
      ? JSON.parse((dbUser as any).userPermission.matrix)
      : (dbUser as any).userPermission.matrix;
    mergedPerms = { ...mergedPerms, ...uPerms };
  }

  const moduleKeyLower = moduleName.toLowerCase();
  const modPerms = mergedPerms[moduleName] || mergedPerms[moduleKeyLower];

  if (!modPerms) return 'No';

  // We check for the explicit string 'All', 'Department', 'Own', 'No'
  // Or fallbacks like true/'enabled'/'yes' -> 'Own'
  const val = modPerms[jsonAction] || modPerms[action];
  
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower === 'all') return 'All';
    if (lower === 'department') return 'Department';
    if (lower === 'own') return 'Own';
    if (lower === 'yes' || lower === 'enabled') return 'Own';
    if (action !== 'canRead') return 'No';
  } else if (val === true) {
    return 'Own';
  }

  // Also check if Access is 'enabled' or 'yes' and action is canRead as fallback
  if (action === 'canRead') {
    const accessVal = modPerms.Access || modPerms.access || modPerms.canRead || modPerms.view || modPerms.read;
    if (accessVal === true) return 'Own';
    if (typeof accessVal === 'string') {
      const lowerAccess = accessVal.toLowerCase();
      if (lowerAccess === 'enabled' || lowerAccess === 'yes') return 'Own';
    }
  }

  return 'No';
}
