import type { Request, Response } from 'express-serve-static-core';
import { prisma } from '../lib/prisma';

// ─── GET /api/team/roles ──────────────────────────────────────────────────────
export const getRoles = async (req: Request, res: Response): Promise<void> => {
  try {
    const defaultRoles = ['Admin', 'Employee'];
    const existingRoles = await prisma.role.findMany({
      where: { name: { in: defaultRoles } },
      select: { name: true }
    });
    
    const existingNames = existingRoles.map(r => r.name);
    const missingRoles = defaultRoles.filter(r => !existingNames.includes(r));

    if (missingRoles.length > 0) {
      await prisma.role.createMany({
        data: missingRoles.map(name => ({ name, permissions: {} })),
        skipDuplicates: true
      });
    }

    const roles = await prisma.role.findMany({
      include: {
        _count: { select: { users: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(roles);
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to fetch roles', error: error.message });
  }
};

// ─── POST /api/team/roles ─────────────────────────────────────────────────────
export const createRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, description, permissions } = req.body as any;

    if (!name || !name.trim()) {
      res.status(400).json({ message: 'Role name is required.' });
      return;
    }

    const existing = await prisma.role.findUnique({ where: { name: name.trim() } });
    if (existing) {
      res.status(400).json({ message: `A role named "${name}" already exists.` });
      return;
    }

    const role = await prisma.role.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        permissions: permissions || {},
      },
    });

    res.status(201).json({ message: 'Role created successfully', role });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to create role', error: error.message });
  }
};

// ─── PUT /api/team/roles/:id ──────────────────────────────────────────────────
export const updateRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = (req as any).params as { id: string };
    const { name, description, permissions } = req.body as any;

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      res.status(404).json({ message: 'Role not found.' });
      return;
    }

    // Check name uniqueness if name is being changed
    if (name && name.trim() !== role.name) {
      const duplicate = await prisma.role.findUnique({ where: { name: name.trim() } });
      if (duplicate) {
        res.status(400).json({ message: `A role named "${name}" already exists.` });
        return;
      }
    }

    const updated = await prisma.role.update({
      where: { id },
      data: {
        name: name?.trim() ?? role.name,
        description: description !== undefined ? description?.trim() || null : role.description,
        permissions: permissions ?? role.permissions,
      },
    });

    res.status(200).json({ message: 'Role updated successfully', role: updated });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to update role', error: error.message });
  }
};

// ─── DELETE /api/team/roles/:id ───────────────────────────────────────────────
export const deleteRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = (req as any).params as { id: string };

    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      res.status(404).json({ message: 'Role not found.' });
      return;
    }

    if (role._count.users > 0) {
      res
        .status(400)
        .json({ message: `Cannot delete "${role.name}" — ${role._count.users} user(s) still assigned. Reassign them first.` });
      return;
    }

    await prisma.role.delete({ where: { id } });
    res.status(200).json({ message: `Role "${role.name}" deleted successfully.` });
  } catch (error: any) {
    res.status(500).json({ message: 'Failed to delete role', error: error.message });
  }
};
