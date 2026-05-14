import { Request, Response } from 'express';
import { Performance } from '../models/Performance';
import { User } from '../models/User';
import { Notification } from '../models/Notification';

export const getPerformanceStats = async (req: Request, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { month, year } = req.query;

    const query: any = { employeeId };
    if (month) query.month = month;
    if (year) query.year = year;

    const stats = await Performance.find(query).sort({ year: -1, month: -1 });
    res.status(200).json(stats);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching performance stats', error: error.message });
  }
};

export const rateEmployee = async (req: Request, res: Response) => {
  try {
    const { employeeId, month, year, taskScore, managerRating, feedback } = req.body;

    // Auto-calculate punctuality score
    // Logic: Start with 100. Deduct 10 for each late entry in that month.
    // For development, mocking late entries to 2.
    const lateEntries = 2;
    const punctualityScore = Math.max(0, 100 - (lateEntries * 10));

    // Overall Score: 40% task, 40% punctuality, 20% manager rating (out of 5 scaled to 100)
    const scaledManagerRating = (managerRating / 5) * 100;
    const calculatedOverallScore = (taskScore * 0.4) + (punctualityScore * 0.4) + (scaledManagerRating * 0.2);

    const performance = await Performance.findOneAndUpdate(
      { employeeId, month, year },
      {
        employeeId, month, year, taskScore, managerRating, feedback,
        punctualityScore, calculatedOverallScore
      },
      { new: true, upsert: true }
    ).populate('employeeId', 'name designation');

    res.status(200).json({ message: 'Employee rated successfully', performance });
  } catch (error: any) {
    res.status(500).json({ message: 'Error rating employee', error: error.message });
  }
};

export const calculateEOTM = async (req: Request, res: Response) => {
  try {
    const { month, year } = req.body;

    // Reset all to false first for that month
    await Performance.updateMany({ month, year }, { isEOTM: false });

    // Find highest score
    const winner = await Performance.findOne({ month, year })
      .sort({ calculatedOverallScore: -1 })
      .populate('employeeId', 'name designation');

    if (!winner) {
      return res.status(404).json({ message: 'No performance records found for this month.' });
    }

    winner.isEOTM = true;
    await winner.save();

    // Announce to everyone
    const allUsers = await User.find();
    const notifications = allUsers.map(u => ({
      userId: u._id,
      message: `🎉 ${(winner.employeeId as any).name} has been awarded Employee of the Month for ${month}/${year}!`,
      type: 'Announcement'
    }));
    await Notification.insertMany(notifications);

    res.status(200).json({ message: 'EOTM calculated successfully! Winner announced.', winner });
  } catch (error: any) {
    res.status(500).json({ message: 'Error calculating EOTM', error: error.message });
  }
};

export const getLatestEOTM = async (req: Request, res: Response) => {
  try {
    const eotm = await Performance.findOne({ isEOTM: true })
      .sort({ year: -1, month: -1 })
      .populate('employeeId', 'name designation');
    
    if (!eotm || !eotm.employeeId) {
      return res.status(200).json(null);
    }

    const emp = eotm.employeeId as any;
    res.status(200).json({
      name: emp.name || 'Unknown',
      designation: emp.designation || 'N/A',
      score: eotm.calculatedOverallScore
    });
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching EOTM', error: error.message });
  }
};
