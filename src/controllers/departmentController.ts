import { MockRequest, MockResponse } from '@/lib/adapter';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDepartments = async (req: MockRequest, res: MockResponse) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { createdAt: 'desc' }
    });

    const allEmployees = await prisma.user.findMany({ 
      select: { 
        id: true, 
        name: true, 
        employeeId: true, 
        department: true, 
        departmentId: true, 
        customDesignation: { select: { name: true } } 
      } 
    });

    const mappedDepartments = departments.map((dept: any) => {
      // 🚀 PROPER RELATIONAL & STRING MATCHING
      const deptEmployees = allEmployees.filter(emp => 
        emp.departmentId === dept.id || 
        (emp.department && emp.department.trim().toLowerCase() === dept.name.trim().toLowerCase())
      );
      
      // Deduplicate
      const uniqueEmployees = Array.from(new Map(deptEmployees.map(emp => [emp.id, emp])).values());

      return {
        ...dept,
        employees: uniqueEmployees.map((u: any) => ({
          id: u.id,
          name: u.name,
          employeeId: u.employeeId,
          designation: u.customDesignation
        })),
        _count: { employees: uniqueEmployees.length }
      };
    });
    
    res.status(200).json(mappedDepartments);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
  }
};

export const createDepartment = async (req: MockRequest, res: MockResponse) => {
  try {
    const { name, description, shiftStartTime, shiftEndTime, lunchStartTime, lunchEndTime, snacksStartTime, snacksEndTime } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const exists = await prisma.department.findUnique({ where: { name } });
    if (exists) return res.status(400).json({ message: 'Department already exists' });

    const newDept = await prisma.department.create({
      data: { 
        name, 
        description, 
        shiftStartTime: shiftStartTime || '09:00',
        shiftEndTime: shiftEndTime || '17:00',
        lunchStartTime,
        lunchEndTime,
        snacksStartTime,
        snacksEndTime
      },
    });

    res.status(201).json(newDept);
  } catch (error: any) {
    console.error('Error creating department:', error);
    res.status(500).json({ message: 'Failed to create department', error: error.message });
  }
};

export const updateDepartment = async (req: MockRequest, res: MockResponse) => {
  try {
    const { id } = req.params;
    const { name, description, shiftStartTime, shiftEndTime, lunchStartTime, lunchEndTime, snacksStartTime, snacksEndTime } = req.body;

    const dataToUpdate: any = { name, description };
    if (shiftStartTime !== undefined) dataToUpdate.shiftStartTime = shiftStartTime;
    if (shiftEndTime !== undefined) dataToUpdate.shiftEndTime = shiftEndTime;
    if (lunchStartTime !== undefined) dataToUpdate.lunchStartTime = lunchStartTime;
    if (lunchEndTime !== undefined) dataToUpdate.lunchEndTime = lunchEndTime;
    if (snacksStartTime !== undefined) dataToUpdate.snacksStartTime = snacksStartTime;
    if (snacksEndTime !== undefined) dataToUpdate.snacksEndTime = snacksEndTime;

    const updated = await prisma.department.update({
      where: { id },
      data: dataToUpdate,
    });

    res.status(200).json(updated);
  } catch (error: any) {
    console.error('Error updating department:', error);
    res.status(500).json({ message: 'Failed to update department', error: error.message });
  }
};

export const deleteDepartment = async (req: MockRequest, res: MockResponse) => {
  try {
    const { id } = req.params;

    // Check if it's being used by checking if any User has this department's name?
    // Since User.department stores raw string, if we delete a Department, the strings in User.department remain intact.
    // That is safe per the current architecture (Option A).

    await prisma.department.delete({ where: { id } });

    res.status(200).json({ message: 'Department deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete department', error: error.message });
  }
};
