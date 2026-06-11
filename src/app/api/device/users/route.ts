import { NextResponse } from 'next/server';
import { getDeviceUsers } from '@/services/zkService';
import { wrapHandler } from '@/lib/adapter';

const getHardwareUsers = async (req: any, res: any) => {
  try {
    const rawUsers = await getDeviceUsers();
    return res.status(200).json({ success: true, users: rawUsers });
  } catch (error: any) {
    console.error('Failed to fetch hardware users:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch users from device' });
  }
};

export const GET = wrapHandler(getHardwareUsers, { protect: true, allowedDesignations: ['Admin', 'Super Admin', 'System Administrator', 'HR Manager', 'Owner'] });
