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
    include: { roles: true } as any
  });

  if (!dbUser || !(dbUser as any).roles || (dbUser as any).roles.length === 0) {
    return false;
  }

  const actionMap: Record<string, string> = {
    canRead: 'Read',
    canCreate: 'Create',
    canEdit: 'Edit',
    canDelete: 'Delete'
  };
  const jsonAction = actionMap[action] || action;

  // Logical OR across all roles
  return (dbUser as any).roles.some((role: any) => {
    const perms = typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions;
    if (!perms || !perms[moduleName]) return false;
    
    const val = perms[moduleName][jsonAction];
    // Access is granted if it's not explicitly 'No' or 'Not Set'
    return val && val !== 'No' && val !== 'Not Set';
  });
}
