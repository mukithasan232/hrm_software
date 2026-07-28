export const checkPermission = (user: any, moduleName: string, action: string = 'access'): boolean => {
  if (!user) return false;

  // 🚀 GOD MODE BYPASS FOR DEVELOPER
  if (user.email === 'dev@fixanyphoto.com') {
    return true;
  }

  // 👑 SUPER ADMIN BYPASS
  if (
    user.userType === 'SUPER_ADMIN' ||
    user.userType === 'ADMIN' ||
    String(user.designation?.name || user.designation || '').toLowerCase().includes('super admin')
  ) {
    return true;
  }

  // Normalize module key to lower case to match the matrix correctly
  const moduleKey = moduleName.toLowerCase();

  // 3. Strictly evaluate user.permissions
  const perms = user.permissions || {};
  
  console.log("Perm Check:", { module: moduleName, action, permissions: perms });

  // Do a true case-insensitive lookup across the permission keys
  const exactKey = Object.keys(perms).find(k => k.toLowerCase() === moduleKey);
  const modPerms = exactKey ? perms[exactKey] : {};

  const getScope = (val: any) => {
    if (typeof val === 'string') return val.toLowerCase().trim();
    if (val === true) return 'enabled';
    return 'no';
  };
  
  const accessScope = getScope(modPerms.access || modPerms.Access || modPerms.view || modPerms.read);
  const readScope = getScope(modPerms.read || modPerms.Read);
  const createScope = getScope(modPerms.create || modPerms.Create);
  const editScope = getScope(modPerms.edit || modPerms.Edit);
  const deleteScope = getScope(modPerms.delete || modPerms.Delete);

  const isAccessAllowed = (scope: string) => ['enabled', 'own', 'all', 'true'].includes(scope);
  const isCrudAllowed = (scope: string) => ['enabled', 'own', 'all', 'true'].includes(scope);

  if ((action === 'access' || action === 'read' || action === 'view') && (isAccessAllowed(accessScope) || isAccessAllowed(readScope))) return true;
  if (action === 'create' && isCrudAllowed(createScope)) return true;
  if (action === 'edit' && isCrudAllowed(editScope)) return true;
  if (action === 'delete' && isCrudAllowed(deleteScope)) return true;

  return false;
};

export const getPermissionScopeSync = (user: any, moduleName: string, action: string = 'read'): 'no' | 'own' | 'department' | 'all' => {
  if (!user) return 'no';

  // 🚀 GOD MODE BYPASS FOR DEVELOPER
  if (user.email === 'dev@fixanyphoto.com') {
    return 'all';
  }

  // 👑 SUPER ADMIN BYPASS
  if (
    user.userType === 'SUPER_ADMIN' ||
    user.userType === 'ADMIN' ||
    String(user.designation?.name || user.designation || '').toLowerCase().includes('super admin')
  ) {
    return 'all';
  }

  const moduleKey = moduleName.toLowerCase();
  const perms = user.permissions || {};
  const exactKey = Object.keys(perms).find(k => k.toLowerCase() === moduleKey);
  const modPerms = exactKey ? perms[exactKey] : {};

  const getScope = (val: any) => {
    if (typeof val === 'string') return val.toLowerCase().trim();
    if (val === true) return 'own';
    return 'no';
  };

  const readScope = getScope(modPerms.read || modPerms.Read);
  const createScope = getScope(modPerms.create || modPerms.Create);
  const editScope = getScope(modPerms.edit || modPerms.Edit);
  const deleteScope = getScope(modPerms.delete || modPerms.Delete);
  
  const actionLower = action.toLowerCase();
  if (actionLower === 'read' || actionLower === 'view' || actionLower === 'access') {
    if (['all', 'department', 'own'].includes(readScope)) return readScope as any;
    const accessScope = getScope(modPerms.access || modPerms.Access);
    if (accessScope === 'enabled') return 'own';
    return accessScope as any;
  }
  if (actionLower === 'create') return createScope as any;
  if (actionLower === 'edit') return editScope as any;
  if (actionLower === 'delete') return deleteScope as any;

  return 'no';
};

import { prisma } from '@/lib/prisma';

/**
 * Universal backend utility to dynamically scope Prisma queries across ALL modules
 * based on exact matrix values (Own, Department, All).
 * ASYNC DB-DRIVEN PERMISSIONS FIX
 */
export const getScopedWhereClause = async (
  sessionUser: any,
  moduleName: string,
  action: 'read' | 'edit' | 'delete' | 'access' | 'view' = 'read',
  overrideEmployeeIdField?: string
) => {
  if (!sessionUser?.email) return { id: 'UNAUTHORIZED_NO_EMAIL' };

  // 1. Fetch the REAL user data from DB directly
  const dbUser = await prisma.user.findUnique({
    where: { email: sessionUser.email },
    include: {
      customDesignation: true,
      roles: true
    }
  });

  if (!dbUser) return { id: 'UNAUTHORIZED_NO_DB_USER' };
  
  const userType = String(dbUser.userType || '').toLowerCase();
  const designationName = String(dbUser.customDesignation?.name || '').toLowerCase();
  const hasAdminRole = dbUser.roles?.some((r: any) => r.name.toLowerCase() === 'admin' || r.name.toLowerCase() === 'super admin');

  if (
    userType === 'super_admin' || 
    userType === 'admin' || 
    hasAdminRole || 
    designationName.includes('super admin') ||
    dbUser.email === 'dev@fixanyphoto.com'
  ) {
    return {}; // God mode
  }

  const perms = (dbUser.permissions as any) || (dbUser.customDesignation?.permissions as any) || {};
  
  const exactKey = Object.keys(perms).find(k => k.toLowerCase() === moduleName.toLowerCase());
  const permissionObj = exactKey ? perms[exactKey] : {};
  
  const actionLower = action.toLowerCase();
  let permissionLevel = 'Own';
  
  if (actionLower === 'read' || actionLower === 'access' || actionLower === 'view') {
    const rawVal = permissionObj.read || permissionObj.Read || permissionObj.access || permissionObj.Access || permissionObj.view || permissionObj.View;
    if (typeof rawVal === 'string') permissionLevel = rawVal; else if (rawVal === true) permissionLevel = 'Own';
  } else if (actionLower === 'create') {
    const rawVal = permissionObj.create || permissionObj.Create;
    if (typeof rawVal === 'string') permissionLevel = rawVal; else if (rawVal) permissionLevel = 'Own';
  } else if (actionLower === 'edit') {
    const rawVal = permissionObj.edit || permissionObj.Edit;
    if (typeof rawVal === 'string') permissionLevel = rawVal; else if (rawVal) permissionLevel = 'Own';
  } else if (actionLower === 'delete') {
    const rawVal = permissionObj.delete || permissionObj.Delete;
    if (typeof rawVal === 'string') permissionLevel = rawVal; else if (rawVal) permissionLevel = 'Own';
  }

  const normalizedLevel = typeof permissionLevel === 'string' ? permissionLevel.toLowerCase().trim() : 'own';

  if (normalizedLevel === 'all' || normalizedLevel === 'global' || normalizedLevel === 'enabled') return {};

  const isEmployeeModel = moduleName.toLowerCase() === 'employees' || moduleName.toLowerCase() === 'team';
  const isTaskModel = moduleName.toLowerCase() === 'tasks';
  const employeeIdField = overrideEmployeeIdField || (isTaskModel ? 'assignedToId' : 'employeeId');
  const userRelationName = isTaskModel ? 'assignedTo' : (isEmployeeModel ? '' : 'user');

  // 2. Safely apply Department Scope using REAL DB departmentId
  if (normalizedLevel === 'department') {
    if (!dbUser.departmentId) return { id: 'BLOCK_NO_DEPT_ASSIGNED' };
    if (isEmployeeModel) return { departmentId: dbUser.departmentId };
    return { [userRelationName]: { departmentId: dbUser.departmentId } };
  }

  // 3. Apply Own Scope
  if (isEmployeeModel) return { id: dbUser.id };
  return { [employeeIdField]: dbUser.id };
};


