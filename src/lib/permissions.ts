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
  if (!userId) return false;

  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    include: { 
      roles: true,
      customDesignation: true,
      userPermission: true
    } as any
  });

  if (!dbUser) return false;

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

  if (!mergedPerms[moduleName]) return false;

  const modPerms = mergedPerms[moduleName];

  const checkValue = (val: any) => {
    if (val === true) return true;
    if (typeof val === 'string' && val.toLowerCase() !== 'no' && val.toLowerCase() !== 'not set' && val.toLowerCase() !== 'not-set') {
      return true;
    }
    return false;
  };

  if (action === 'canRead' && (checkValue(modPerms.Read) || checkValue(modPerms.Access) || checkValue(modPerms.canRead))) return true;
  if (action === 'canCreate' && (checkValue(modPerms.Create) || checkValue(modPerms.canCreate))) return true;
  if (action === 'canEdit' && (checkValue(modPerms.Edit) || checkValue(modPerms.canEdit))) return true;
  if (action === 'canDelete' && (checkValue(modPerms.Delete) || checkValue(modPerms.canDelete))) return true;

  return false;
}
