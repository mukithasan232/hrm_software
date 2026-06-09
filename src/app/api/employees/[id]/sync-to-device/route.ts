import { NextResponse } from 'next/server';
import { zkService, ZKDeviceOfflineError } from '@/services/zkService';
import { prisma } from '@/lib/prisma';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const employee = await prisma.user.findUnique({
      where: { id }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (!(employee as any).zk_enroll_number) {
      return NextResponse.json(
        { error: `Employee ${id} has no ZKTeco enroll number assigned. Assign one before syncing.` },
        { status: 400 }
      );
    }

    try {
      const syncResult = await zkService.syncUserToDevice({
        id: employee.id,
        zk_enroll_number: (employee as any).zk_enroll_number,
        name: employee.name,
        role: employee.designationId ? 0 : 0, // Simplified role mapping based on what's available
        password: '0'
      });

      // Log success
      await (prisma as any).zkSyncLog.create({
        data: {
          employeeId: employee.id,
          enrollNumber: (employee as any).zk_enroll_number,
          action: syncResult.action,
          status: 'success'
        }
      });

      return NextResponse.json(syncResult, { status: 200 });

    } catch (error: any) {
      if (error instanceof ZKDeviceOfflineError || error.name === 'ZKDeviceOfflineError') {
        // Enqueue the job for offline processing
        await (prisma as any).zkSyncQueue.create({
          data: {
            employeeId: employee.id,
            status: 'pending'
          }
        });

        return NextResponse.json(
          { error: 'Device offline. Sync queued for automatic retry.' },
          { status: 503 }
        );
      }

      throw error; // Let the outer catch handle other errors
    }

  } catch (error: any) {
    console.error('[SyncRoute] Error syncing to device:', error);
    
    // Log failure if possible
    try {
      const { id } = await params;
      const employee = await prisma.user.findUnique({ where: { id } });
      if (employee && (employee as any).zk_enroll_number) {
        await (prisma as any).zkSyncLog.create({
          data: {
            employeeId: id,
            enrollNumber: (employee as any).zk_enroll_number,
            action: 'unknown',
            status: 'failure',
            errorMessage: error.message || 'Unknown error'
          }
        });
      }
    } catch (e) {
      // Ignore inner logging error
    }

    return NextResponse.json(
      { error: 'Internal server error during device sync' },
      { status: 500 }
    );
  }
}
