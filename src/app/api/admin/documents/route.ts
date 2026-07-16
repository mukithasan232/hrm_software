export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { wrapHandler } from '@/lib/adapter';
import { checkPermission } from '@/utils/checkPermission';

// GET all employees who have uploaded documents and are awaiting verification
export const GET = wrapHandler(async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userRoleStr = (user as any)?.role?.toUpperCase() || '';
    const hasAdminRoleArray = user?.roles?.some((r: any) => r.name?.toUpperCase().includes('ADMIN'));
    const isDesignationAdmin = String((user as any)?.designation || '').toUpperCase().includes('ADMIN');
    const isUserTypeAdmin = String((user as any)?.userType || '').toUpperCase().includes('ADMIN');

    const isAdmin = userRoleStr.includes('ADMIN') || hasAdminRoleArray || isDesignationAdmin || isUserTypeAdmin;

    if (!isAdmin) {
      return res.status(403).json({ message: 'Forbidden: Admin access required' });
    }

    // Fetch employees who are UNVERIFIED or PENDING_VERIFICATION and have uploaded documents
    const employees = await prisma.user.findMany({
      where: {
        userType: 'Employee',
        verificationStatus: {
          in: ['UNVERIFIED', 'PENDING_VERIFICATION']
        },
        documents: {
          not: '[]' // Assuming empty json array string
        }
      },
      select: {
        id: true,
        employeeId: true,
        name: true,
        email: true,
        verificationStatus: true,
        documents: true,
        updatedAt: true
      },
      orderBy: { updatedAt: 'desc' }
    });

    // We must filter out employees who technically have empty arrays if they were saved as valid JSON but empty
    const validEmployees = employees.filter(emp => {
      if (!emp.documents) return false;
      if (Array.isArray(emp.documents) && emp.documents.length > 0) return true;
      if (typeof emp.documents === 'string' && emp.documents.length > 2 && emp.documents !== '[]') return true;
      return false;
    });

    return res.status(200).json(validEmployees);
  } catch (error: any) {
    console.error('Error fetching documents:', error);
    return res.status(500).json({ message: 'Failed to fetch documents', error: error.message });
  }
}, { protect: true });

// DELETE documents for an employee (Reset to UNVERIFIED)
export const DELETE = wrapHandler(async (req: any, res: any) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    const userRoleStr = (user as any)?.role?.toUpperCase() || '';
    const hasAdminRoleArray = user?.roles?.some((r: any) => r.name?.toUpperCase().includes('ADMIN'));
    const isDesignationAdmin = String((user as any)?.designation || '').toUpperCase().includes('ADMIN');
    const isUserTypeAdmin = String((user as any)?.userType || '').toUpperCase().includes('ADMIN');

    const isAdmin = userRoleStr.includes('ADMIN') || hasAdminRoleArray || isDesignationAdmin || isUserTypeAdmin;

    if (!isAdmin) return res.status(403).json({ message: 'Forbidden: Admin access required' });

    const url = new URL(req.url, 'http://localhost');
    const employeeId = url.searchParams.get('employeeId');

    if (!employeeId) return res.status(400).json({ message: 'Employee ID is required' });

    await prisma.user.update({
      where: { id: employeeId },
      data: {
        documents: [],
        verificationStatus: 'UNVERIFIED'
      }
    });

    return res.status(200).json({ message: 'Documents cleared and employee status reset.' });
  } catch (error: any) {
    console.error('Error deleting documents:', error);
    return res.status(500).json({ message: 'Failed to delete documents', error: error.message });
  }
}, { protect: true });
