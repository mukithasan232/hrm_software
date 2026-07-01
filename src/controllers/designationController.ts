import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';

// ─── GET /api/team/designations ──────────────────────────────────────────────────────
export const getDesignations = async (req: Request, res: Response): Promise<void> => {
  try {
    const designations = await prisma.designation.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(designations);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch designations', error: error.message });
  }
};

// ─── POST /api/team/designations ─────────────────────────────────────────────────────
export const createDesignation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, permissions, leaveConfig } = req.body as any;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Designation name is required.' });
      return;
    }

    const existing = await prisma.designation.findUnique({ where: { name: name.trim() } });
    if (existing) {
      res.status(400).json({ message: `A designation named "${name}" already exists.` });
      return;
    }

    const designation = await prisma.designation.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        permissions: permissions || {},
        leaveConfig: leaveConfig || {},
        totalCasualLeaves: leaveConfig?.casual || 0,
        totalSickLeaves: leaveConfig?.sick || 0,
      },
    });

    res.status(201).json({ message: 'Designation created successfully', designation });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create designation', error: error.message });
  }
};

// ─── PUT /api/team/designations/:id ──────────────────────────────────────────────────
export const updateDesignation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = (req as any).params as { id: string };
    const { name, description, permissions, leaveConfig } = req.body as any;

    const designation = await prisma.designation.findUnique({ where: { id } });
    if (!designation) {
      res.status(404).json({ message: 'Designation not found.' });
      return;
    }

    // Check name uniqueness if name is being changed
    if (name && name.trim() !== designation.name) {
      const duplicate = await prisma.designation.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        res.status(400).json({ message: `A designation named "${name}" already exists.` });
        return;
      }
    }

    const updated = await prisma.designation.update({
      where: { id },
      data: {
        name: name?.trim() ?? designation.name,
        description: description !== undefined ? description?.trim() || null : designation.description,
        permissions: permissions ?? designation.permissions,
        leaveConfig: leaveConfig ?? designation.leaveConfig,
        totalCasualLeaves: leaveConfig?.casual ?? designation.totalCasualLeaves,
        totalSickLeaves: leaveConfig?.sick ?? designation.totalSickLeaves,
      },
    });

    res.status(200).json({ message: 'Designation updated successfully', designation: updated });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update designation', error: error.message });
  }
};

// ─── DELETE /api/team/designations/:id ───────────────────────────────────────────────
export const deleteDesignation = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = (req as any).params as { id: string };

    const designation = await prisma.designation.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!designation) {
      res.status(404).json({ message: 'Designation not found.' });
      return;
    }

    if (designation._count.users > 0) {
      res
        .status(400)
        .json({ message: `Cannot delete "${designation.name}" — ${designation._count.users} user(s) still assigned. Reassign them first.` });
      return;
    }

    await prisma.designation.delete({ where: { id } });
    res.status(200).json({ message: `Designation "${designation.name}" deleted successfully.` });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete designation', error: error.message });
  }
};
