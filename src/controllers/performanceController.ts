import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';

export const getPerformanceStats = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const where: any = { employeeId };
    if (month) where.month = Number(month);
    if (year) where.year = Number(year);

    const stats = await prisma.performance.findMany({
      where,
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ]
    });
    res.status(200).json(stats);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching performance stats', error: error.message });
  }
};

export const rateEmployee = async (req: Request, res: Response) => {
  try {
    const { employeeId, month, year, taskScore, managerRating, feedback } = req.body;

    const lateEntries = 2;
    const punctualityScore = Math.max(0, 100 - (lateEntries * 10));

    const scaledManagerRating = (managerRating / 5) * 100;
    const calculatedOverallScore = (taskScore * 0.4) + (punctualityScore * 0.4) + (scaledManagerRating * 0.2);

    const performance = await prisma.performance.upsert({
      where: {
        employeeId_month_year: {
          employeeId,
          month: Number(month),
          year: Number(year)
        }
      },
      update: {
        taskScore,
        managerRating,
        feedback,
        punctualityScore,
        calculatedOverallScore
      },
      create: {
        employeeId,
        month: Number(month),
        year: Number(year),
        taskScore,
        managerRating,
        feedback,
        punctualityScore,
        calculatedOverallScore
      },
      include: {
        employee: {
          select: { name: true, designation: true }
        }
      }
    });

    res.status(200).json({ message: 'Employee rated successfully', performance });
  } catch (error: any) {
    res.status(500).json({ message: 'Error rating employee', error: error.message });
  }
};

export const calculateEOTM = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;

    await prisma.performance.updateMany({
      where: { month: Number(month), year: Number(year) },
      data: { isEOTM: false }
    });

    const winner = await prisma.performance.findFirst({
      where: { month: Number(month), year: Number(year) },
      orderBy: { calculatedOverallScore: 'desc' },
      include: {
        employee: {
          select: { name: true, designation: true }
        }
      }
    });

    if (!winner) {
      return res.status(404).json({ message: 'No performance records found for this month.' });
    }

    const updatedWinner = await prisma.performance.update({
      where: { id: winner.id },
      data: { isEOTM: true }
    });

    const allUsers = await prisma.user.findMany();
    const safeAllUsers = Array.isArray(allUsers) ? allUsers : [];
    const notifications = safeAllUsers.map((u: any) => ({
      userId: u.id,
      message: `🎉 ${winner.employee.name} has been awarded Employee of the Month for ${month}/${year}!`,
      type: 'Announcement'
    }));

    await prisma.notification.createMany({
      data: notifications
    });

    res.status(200).json({ message: 'EOTM calculated successfully! Winner announced.', winner: updatedWinner });
  } catch (error: any) {
    res.status(500).json({ message: 'Error calculating EOTM', error: error.message });
  }
};

export const getLatestEOTM = async (req: Request, res: Response) => {
  try {
    const eotm = await prisma.performance.findFirst({
      where: { isEOTM: true },
      orderBy: [
        { year: 'desc' },
        { month: 'desc' }
      ],
      include: {
        employee: {
          select: { name: true, designation: true }
        }
      }
    });
    
    if (!eotm) {
      return res.status(200).json(null);
    }

    res.status(200).json({
      name: eotm.employee.name || 'Unknown',
      designation: eotm.employee.designation || 'N/A',
      score: eotm.calculatedOverallScore
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching EOTM', error: error.message });
  }
};
