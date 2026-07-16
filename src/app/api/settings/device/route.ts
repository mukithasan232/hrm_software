import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';

const getDevice = async (req: any, res: any) => {
  try {
    const device = await (prisma as any).device.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'desc' }
    });
    return res.status(200).json(device || {});
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

const saveDevice = async (req: any, res: any) => {
  try {
    const { name, ipAddress, port, commKey } = req.body;
    
    if (!ipAddress) {
      return res.status(400).json({ error: 'IP Address is required' });
    }

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
      include: { customDesignation: true, roles: true }
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
      return res.status(403).json({ error: 'Access Denied: Missing Manage System Settings permission' });
    }

    // Upsert or create the first device (for single-tenant simple usage)
    const existing = await (prisma as any).device.findFirst();
    
    let device;
    if (existing) {
      device = await (prisma as any).device.update({
        where: { id: existing.id },
        data: { name: name || 'Main Device', ipAddress, port: Number(port), commKey: Number(commKey) }
      });
    } else {
      device = await (prisma as any).device.create({
        data: { name: name || 'Main Device', ipAddress, port: Number(port), commKey: Number(commKey), isActive: true }
      });
    }

    return res.status(200).json({ success: true, message: 'Device settings updated', device });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const GET = wrapHandler(getDevice, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'Owner'] });
export const POST = wrapHandler(saveDevice, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'Owner'] });
