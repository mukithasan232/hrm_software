export const formatRole = (role: string | null | undefined): string => {
  if (!role) return 'Employee';
  
  return role
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

export const getDisplayRole = (user: any): string => {
  if (!user) return 'Employee';
  
  if (
    user.role === 'SUPER_ADMIN' || 
    user.userType === 'SUPER_ADMIN' ||
    user.roles?.some((r: any) => r?.name === 'SUPER_ADMIN') || 
    user.email === 'admin@fixanyphoto.com' ||
    user.email === 'dev@fixanyphoto.com'
  ) {
    return 'Super Admin';
  }
  
  if (user.role === 'ADMIN' || user.userType === 'ADMIN' || user.roles?.some((r: any) => r?.name === 'ADMIN')) {
    return 'Admin';
  }
  
  if (typeof user.designation === 'object' && user.designation?.name) {
    return user.designation.name;
  }
  
  if (typeof user.designation === 'string' && user.designation) {
    return user.designation;
  }
  
  if (user.role || user.userType) {
    return formatRole(user.role || user.userType);
  }
  
  return 'Employee';
};
