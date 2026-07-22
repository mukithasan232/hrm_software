import { wrapHandler } from '@/lib/adapter';
import { prisma } from '@/lib/prisma';
import type { Request, Response } from 'express-serve-static-core';

export const GET = wrapHandler(async (req: Request, res: Response) => {
  try {
    let config = await (prisma as any).moduleConfig.findFirst();
    if (!config) {
      config = await (prisma as any).moduleConfig.create({
        data: {
          isLeaveModuleEnabled: true,
          isTaskModuleEnabled: true,
          isAttendanceEnabled: true,
        },
      });
    }
    return res.status(200).json(config);
  } catch (error: any) {
    console.error('[ModuleConfig GET]', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}, { protect: true });

export const PATCH = wrapHandler(async (req: Request, res: Response) => {
  try {
    const userRole = (req as any).user.designation?.toLowerCase();
    const isSuperAdmin = (req as any).user.email === 'dev@fixanyphoto.com' || (req as any).user.email === 'admin@fixanyphoto.com' || userRole?.includes('admin');
    
    if (!isSuperAdmin) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const { isLeaveModuleEnabled, isTaskModuleEnabled, isAttendanceEnabled } = req.body;
    
    let config = await (prisma as any).moduleConfig.findFirst();
    
    if (config) {
      config = await (prisma as any).moduleConfig.update({
        where: { id: config.id },
        data: {
          ...(isLeaveModuleEnabled !== undefined && { isLeaveModuleEnabled }),
          ...(isTaskModuleEnabled !== undefined && { isTaskModuleEnabled }),
          ...(isAttendanceEnabled !== undefined && { isAttendanceEnabled }),
        },
      });
    } else {
      config = await (prisma as any).moduleConfig.create({
        data: {
          isLeaveModuleEnabled: isLeaveModuleEnabled ?? true,
          isTaskModuleEnabled: isTaskModuleEnabled ?? true,
          isAttendanceEnabled: isAttendanceEnabled ?? true,
        },
      });
    }

    return res.status(200).json({ message: 'Module settings updated successfully', config });
  } catch (error: any) {
    console.error('[ModuleConfig PATCH]', error);
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
}, { protect: true });
