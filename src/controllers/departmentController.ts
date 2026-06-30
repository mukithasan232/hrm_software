import { MockRequest, MockResponse } from '@/lib/adapter';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDepartments = async (req: MockRequest, res: MockResponse) => {
  try {
    const departments = await prisma.department.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(departments);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch departments', error: error.message });
  }
};

export const createDepartment = async (req: MockRequest, res: MockResponse) => {
  try {
    const { name, description, leaveConfig, shiftStartTime, shiftEndTime } = req.body;
    if (!name) return res.status(400).json({ message: 'Name is required' });

    const exists = await prisma.department.findUnique({ where: { name } });
    if (exists) return res.status(400).json({ message: 'Department already exists' });

    const newDept = await prisma.department.create({
      data: { 
        name, 
        description, 
        leaveConfig: leaveConfig || {},
        totalCasualLeaves: leaveConfig?.casual || 0,
        totalSickLeaves: leaveConfig?.sick || 0,
        shiftStartTime: shiftStartTime || '09:00',
        shiftEndTime: shiftEndTime || '17:00'
      },
    });

    res.status(201).json(newDept);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create department', error: error.message });
  }
};

export const updateDepartment = async (req: MockRequest, res: MockResponse) => {
  try {
    const { id } = req.params;
    const { name, description, leaveConfig, shiftStartTime, shiftEndTime } = req.body;

    const dataToUpdate: any = { name, description };
    if (leaveConfig !== undefined) {
      dataToUpdate.leaveConfig = leaveConfig;
      dataToUpdate.totalCasualLeaves = leaveConfig?.casual || 0;
      dataToUpdate.totalSickLeaves = leaveConfig?.sick || 0;
    }
    if (shiftStartTime !== undefined) dataToUpdate.shiftStartTime = shiftStartTime;
    if (shiftEndTime !== undefined) dataToUpdate.shiftEndTime = shiftEndTime;

    const updated = await prisma.department.update({
      where: { id },
      data: dataToUpdate,
    });

    res.status(200).json(updated);
  } catch (error: any) {
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
