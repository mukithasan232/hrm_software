export const checkPermission = (user: any, moduleName: string, action: string = 'access'): boolean => {
  if (!user) return false;

  // 🚀 GOD MODE BYPASS FOR DEVELOPER
  if (user.email === 'dev@fixanyphoto.com' || user.role === 'SUPER_ADMIN' || user.roles?.some((r: any) => r?.name === 'SUPER_ADMIN')) {
    return true;
  }

  // 1. Check if user is Admin / Super Admin via designation or string role
  const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'hrm manager'];
  const designName = typeof user.designation === 'object' ? user.designation?.name : user.designation;
  const userDesig = (designName || '').toLowerCase().trim();
  const userRoleStr = typeof user.role === 'string' ? user.role.toLowerCase().trim() : '';

  // 2. Check if user has an Admin role in roles array
  const hasAdminRole = user.roles?.some((r: any) =>
    ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim())
  );

  if (ADMIN_DESIGNATIONS.includes(userDesig) || ADMIN_DESIGNATIONS.includes(userRoleStr) || hasAdminRole) {
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
  const isCrudAllowed = (scope: string) => ['own', 'all', 'true'].includes(scope);

  if ((action === 'access' || action === 'read' || action === 'view') && (isAccessAllowed(accessScope) || isAccessAllowed(readScope))) return true;
  if (action === 'create' && isCrudAllowed(createScope)) return true;
  if (action === 'edit' && isCrudAllowed(editScope)) return true;
  if (action === 'delete' && isCrudAllowed(deleteScope)) return true;

  return false;
};

export const getPermissionScopeSync = (user: any, moduleName: string, action: string = 'read'): 'no' | 'own' | 'department' | 'all' => {
  if (!user) return 'no';

  // 🚀 GOD MODE BYPASS FOR DEVELOPER
  if (user.email === 'dev@fixanyphoto.com' || user.role === 'SUPER_ADMIN' || user.roles?.some((r: any) => r?.name === 'SUPER_ADMIN')) {
    return 'all';
  }

  const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'hrm manager'];
  const designName = typeof user.designation === 'object' ? user.designation?.name : user.designation;
  const userDesig = (designName || '').toLowerCase().trim();
  const userRoleStr = typeof user.role === 'string' ? user.role.toLowerCase().trim() : '';
  const hasAdminRole = user.roles?.some((r: any) => ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim()));

  if (ADMIN_DESIGNATIONS.includes(userDesig) || ADMIN_DESIGNATIONS.includes(userRoleStr) || hasAdminRole) {
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
