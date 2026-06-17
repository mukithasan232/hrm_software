import { NextResponse } from 'next/server';
import { getDeviceUsers } from '@/services/zkService';
import { wrapHandler } from '@/lib/adapter';
import { prisma } from '@/lib/prisma';

const getHardwareUsers = async (req: any, res: any) => {
  try {
    const rawUsers = await getDeviceUsers();
    return res.status(200).json({ success: true, users: rawUsers });
  } catch (error: any) {
    console.error('Failed to fetch hardware users directly, falling back to database heuristic logs:', error.message || error);
    
    try {
      // Fallback: Infer unregistered users from RawDeviceLog
      // 1. Get all mapped ZKTeco IDs
      const mappedUsers = await prisma.user.findMany({
        where: { zktecoId: { not: null } },
        select: { zktecoId: true }
      });
      const mappedIds = new Set(mappedUsers.map(u => String(u.zktecoId)));

      // 2. Get all distinct deviceUserIds from RawDeviceLog
      const rawLogs = await prisma.rawDeviceLog.findMany({
        select: { deviceUserId: true },
        distinct: ['deviceUserId']
      });

      // 3. Filter out the ones already mapped
      const unmappedIds = rawLogs
        .map(log => log.deviceUserId)
        .filter(id => !mappedIds.has(id));

      // 4. Format them to match the expected UI structure
      const inferredUsers = unmappedIds.map(id => ({
        userId: id,
        name: `Unregistered ID: ${id} (From Logs)`,
        role: 0
      }));

      return res.status(200).json({ 
        success: true, 
        users: inferredUsers,
        message: 'Device offline. Displaying users inferred from pending attendance logs.'
      });
    } catch (fallbackError) {
      return res.status(500).json({ error: 'Failed to fetch users and fallback failed' });
    }
  }
};

export const GET = wrapHandler(getHardwareUsers, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Owner'] });

export const GET = wrapHandler(getHardwareUsers, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Owner'] });
