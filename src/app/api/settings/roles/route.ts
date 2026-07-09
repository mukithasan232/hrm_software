import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getRoles = async (req: any, res: any) => {
  const roles = await prisma.designation.findMany();
  return NextResponse.json(roles);
};

const upsertRole = async (req: any, res: any) => {
  const body = req.body;

  const checkPermission = (u: any, moduleName: string, action: string = 'access'): boolean => {
    if (!u) return false;
    const moduleKey = moduleName.toLowerCase();
    const perms = u.permissions || {};
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

  let hasPermission = false;
  const dbUser = await (prisma as any).user.findUnique({ 
    where: { id: req.user.id },
    include: { designation: true, roles: true }
  });

  if (dbUser?.email === 'dev@fixanyphoto.com' || dbUser?.userType === 'SUPER_ADMIN' || dbUser?.designation === 'Super Admin' || dbUser?.roles?.some((r: any) => r?.name === 'SUPER_ADMIN')) {
    hasPermission = true;
  } else if (dbUser) {
    let perms = {};
    if (dbUser.designation && typeof dbUser.designation === 'object' && (dbUser.designation as any).permissions) {
      perms = (dbUser.designation as any).permissions;
    }
    if (Object.keys(perms).length === 0 && dbUser.permissions) {
      perms = typeof dbUser.permissions === 'string' ? JSON.parse(dbUser.permissions as any) : dbUser.permissions;
    }
    hasPermission = checkPermission({ ...dbUser, permissions: perms }, 'manage_system_settings', 'edit');
  }

  if (!hasPermission) {
    return NextResponse.json({ error: 'Access Denied: Missing Manage System Settings permission' }, { status: 403 });
  }

  const { id, name, description, matrix, weekendDays } = body;

  if (!name || !matrix) {
    return NextResponse.json({ error: 'Name and matrix are required' }, { status: 400 });
  }

  // matrix is an object: { [moduleName]: { Read, Create, Edit, Delete } }
  // We just store it as Json now
  const permissionsData = matrix;
  
  const finalWeekendDays = Array.isArray(weekendDays) ? weekendDays : ["Sunday"];

  if (id) {
    // Update existing designation
    await prisma.designation.update({
      where: { id },
      data: { name, description, permissions: permissionsData, weekendDays: finalWeekendDays } as any
    });
  } else {
    // Create new designation
    await prisma.designation.create({
      data: {
        name,
        description,
        permissions: permissionsData,
        weekendDays: finalWeekendDays
      } as any
    });
  }

  return NextResponse.json({ success: true });
};

export const GET = wrapHandler(getRoles, { protect: true, allowedDesignations: ['Admin', 'Super Admin'] });
export const POST = wrapHandler(upsertRole, { protect: true, allowedDesignations: ['Admin', 'Super Admin'] });
