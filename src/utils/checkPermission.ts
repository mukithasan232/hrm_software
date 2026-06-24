export const checkPermission = (user: any, moduleName: string, action: string = 'view'): boolean => {
  if (!user) return false;

  // 1. Check if user is Admin / Super Admin via designation
  const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'hrm manager'];
  const designName = typeof user.designation === 'object' ? user.designation?.name : user.designation;
  const userDesig = (designName || '').toLowerCase().trim();

  // 2. Check if user has an Admin role in roles array
  const hasAdminRole = user.roles?.some((r: any) =>
    ADMIN_DESIGNATIONS.includes((r?.name || r)?.toLowerCase()?.trim())
  );

  if (ADMIN_DESIGNATIONS.includes(userDesig) || hasAdminRole) {
    return true;
  }

  // Normalize module key to lower case to match the matrix correctly, though usually exact
  const moduleKey = moduleName.toLowerCase();

  // 3. Parse specific user.permissions JSON (already parsed in session payload)
  if (user.permissions) {
    // Try both exact moduleName and lowercase moduleKey
    const modPerms = user.permissions[moduleName] || user.permissions[moduleKey];
    
    if (modPerms) {
      const checkValue = (val: any) => {
        if (val === true) return true;
        if (typeof val === 'string' && val.toLowerCase() === 'true') return true;
        if (typeof val === 'string' && val.toLowerCase() === 'yes') return true;
        return false;
      };
      
      if (action === 'view' && (checkValue(modPerms.view) || checkValue(modPerms.canRead) || checkValue(modPerms.Read) || checkValue(modPerms.Access))) return true;
      if (action === 'create' && (checkValue(modPerms.create) || checkValue(modPerms.canCreate) || checkValue(modPerms.Create))) return true;
      if (action === 'edit' && (checkValue(modPerms.edit) || checkValue(modPerms.canEdit) || checkValue(modPerms.Edit))) return true;
      if (action === 'delete' && (checkValue(modPerms.delete) || checkValue(modPerms.canDelete) || checkValue(modPerms.Delete))) return true;
    }
  }

  return false;
};
