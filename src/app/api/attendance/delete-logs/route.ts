import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseRequest } from '@/lib/adapter';
import { checkPermission } from '@/utils/checkPermission';

export async function DELETE(req: NextRequest) {
    try {
        const body = await req.json();
        const { ids } = body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: 'Invalid IDs provided' }, { status: 400 });
        }

        const mockReq = await parseRequest(req);
        
        const hasAccess = checkPermission(mockReq.user, 'Attendance', 'delete');
        let admin = hasAccess;
        
        if (!admin && mockReq.user?.id) {
           const dbUser = await prisma.user.findUnique({ where: { id: mockReq.user.id } });
           if (dbUser?.email === 'dev@fixanyphoto.com' || dbUser?.userType === 'SUPER_ADMIN' || dbUser?.designation === 'Super Admin' || dbUser?.userType === 'ADMIN') {
             admin = true;
           }
        }

        if (!admin) {
          return NextResponse.json({ error: "Unauthorized. Admin privileges required." }, { status: 403 });
        }

        // Delete the actual AttendanceLog records from the database
        await prisma.attendanceLog.deleteMany({
            where: {
                id: { in: ids }
            }
        });

        return NextResponse.json({ message: 'Logs deleted successfully' }, { status: 200 });
    } catch (error: any) {
        console.error('Delete logs error:', error.message || error);
        return NextResponse.json({ error: error.message || 'Failed to delete logs' }, { status: 500 });
    }
}
