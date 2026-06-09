export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { fetchUnregisteredDeviceUsers } from '@/services/zkService';

export async function GET() {
  try {
    const users = await fetchUnregisteredDeviceUsers();
    return NextResponse.json(users);
  } catch (error: any) {
    console.error('Failed to fetch unregistered device users:', error);
    return NextResponse.json({ message: 'Device offline or unreachable', error: error.message }, { status: 503 });
  }
}
