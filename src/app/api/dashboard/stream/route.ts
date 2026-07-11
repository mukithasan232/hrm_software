import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';
import { getBDToday } from '@/lib/dateUtils';

const getGlobalStream = async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    // Fetch recent tasks
    const tasks = await prisma.task.findMany({
      take: 20,
      orderBy: { createdAt: 'desc' },
      include: {
        assignedBy: { select: { name: true, avatar: true } },
        assignedTo: { select: { name: true, avatar: true } },
      }
    });

    // Fetch recent attendance logs
    const todayStr = getBDToday();
    const attendance = await prisma.attendanceLog.findMany({
      take: 20,
      orderBy: { timestamp: 'desc' },
      include: {
        employee: { select: { name: true, avatar: true } },
      }
    });

    // Merge and sort
    const merged = [
      ...tasks.map(t => ({
        type: 'TASK',
        id: `task-${t.id}`,
        title: `Task: ${t.title}`,
        status: t.status,
        timestamp: t.createdAt,
        user: t.assignedTo,
        author: t.assignedBy
      })),
      ...attendance.map(a => ({
        type: 'ATTENDANCE',
        id: `att-${a.id}`,
        title: `${a.punchType} - ${a.deviceLocation || 'Web'}`,
        status: 'SUCCESS',
        timestamp: a.timestamp,
        user: a.employee,
        author: null
      }))
    ];

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({ success: true, data: merged.slice(0, 30) });
  } catch (error: any) {
    console.error('Global stream error:', error);
    return res.status(500).json({ error: error.message });
  }
};

export const GET = wrapHandler(getGlobalStream, { protect: true });
