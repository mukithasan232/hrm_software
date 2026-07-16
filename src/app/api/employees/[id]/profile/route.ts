export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';
import { formatInTimeZone } from 'date-fns-tz';

const BD_TZ = 'Asia/Dhaka';

export const GET = wrapHandler(async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const url = new URL(req.url, 'http://localhost');
    // Extract ID from /api/employees/[id]/profile
    const pathParts = url.pathname.split('/');
    const employeeId = pathParts[pathParts.length - 2]; 

    const employee = await prisma.user.findUnique({
      where: { id: employeeId },
      include: {
        customDepartment: true,
        customDesignation: true,
        shift: true,
        assignedTasks: {
          where: { status: { not: 'COMPLETED' } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!employee) {
      return res.status(404).json({ message: 'User not found' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rawLogs = await prisma.attendanceLog.findMany({
      where: {
        employeeId: employee.employeeId,
        timestamp: { gte: thirtyDaysAgo }
      },
      orderBy: { timestamp: 'desc' }
    });

    const logsByDate: Record<string, any> = {};
    rawLogs.forEach(log => {
      const dateStr = formatInTimeZone(log.timestamp, BD_TZ, 'yyyy-MM-dd');
      if (!logsByDate[dateStr]) logsByDate[dateStr] = { checkIn: null, checkOut: null };
      
      if (log.punchType?.toLowerCase().includes('in')) {
        if (!logsByDate[dateStr].checkIn || new Date(log.timestamp) < new Date(logsByDate[dateStr].checkIn)) {
          logsByDate[dateStr].checkIn = log.timestamp;
        }
      } else if (log.punchType?.toLowerCase().includes('out')) {
        if (!logsByDate[dateStr].checkOut || new Date(log.timestamp) > new Date(logsByDate[dateStr].checkOut)) {
          logsByDate[dateStr].checkOut = log.timestamp;
        }
      }
    });

    const recentDates = Object.keys(logsByDate).sort((a, b) => new Date(b).getTime() - new Date(a).getTime()).slice(0, 7);

    return res.status(200).json({
      employee,
      recentDates,
      logsByDate
    });
  } catch (error: any) {
    console.error('Error fetching employee profile:', error);
    return res.status(500).json({ message: 'Failed to fetch employee profile' });
  }
}, { protect: true });
