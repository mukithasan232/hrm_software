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
