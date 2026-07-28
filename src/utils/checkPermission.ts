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

/**
 * Universal backend utility to dynamically scope Prisma queries across ALL modules
 * based on exact matrix values (Own, Department, All).
 */
export const getScopedWhereClause = (
  user: any,
  moduleName: string,
  action: 'read' | 'edit' | 'delete' = 'read',
  overrideEmployeeIdField?: string
) => {
  // 1. Get the specific permission level for the module and action
  const permissionLevel = getPermissionScopeSync(user, moduleName, action);

  // 2. Return dynamic Prisma 'where' constraints
  if (permissionLevel === 'all') {
    return {}; 
  }
  
  const isEmployeeModel = moduleName.toLowerCase() === 'employees' || moduleName.toLowerCase() === 'team';
  const isTaskModel = moduleName.toLowerCase() === 'tasks';
  
  const employeeIdField = overrideEmployeeIdField || (isTaskModel ? 'assignedToId' : 'employeeId');
  const userRelationName = isTaskModel ? 'assignedTo' : (isEmployeeModel ? '' : 'user');

  if (permissionLevel === 'department') {
    if (isEmployeeModel) {
      // For Employee table, query departmentId directly
      return user.departmentId 
        ? { departmentId: user.departmentId } 
        : { department: user.department };
    }
    // For other tables, query through the user relation
    return { 
      [userRelationName]: user.departmentId
        ? { departmentId: user.departmentId }
        : { department: user.department }
    }; 
  }
  
  // Default to 'Own' or restricted access
  if (isEmployeeModel) {
    return { id: user.id }; 
  }
  return { [employeeIdField]: user.id }; 
};

