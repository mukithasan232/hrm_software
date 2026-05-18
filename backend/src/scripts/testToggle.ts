import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { prisma } from '../lib/prisma';
import { toggleEmployeeStatus } from '../controllers/userController';
import { Request, Response } from 'express';

async function testToggle() {
  console.log('--- Testing Employee Status Toggle Controller ---');
  try {
    // 1. Find a test employee
    const user = await prisma.user.findFirst();
    if (!user) {
      console.log('❌ No user found in the database to toggle!');
      return;
    }

    console.log(`👤 Found target user: ${user.name} (ID: ${user.id}, Active: ${user.isActive})`);

    // 2. Mock Express request and response
    const req = {
      params: {
        id: user.id
      }
    } as unknown as Request;

    const res = {
      status(code: number) {
        console.log(`[Response] Status Code: ${code}`);
        return this;
      },
      json(body: any) {
        console.log('[Response] Body:', JSON.stringify(body, null, 2));
        return this;
      }
    } as unknown as Response;

    // 3. Execute controller
    console.log('🚀 Executing toggleEmployeeStatus...');
    await toggleEmployeeStatus(req, res);

  } catch (err: any) {
    console.error('💥 Execution failed:', err);
  } finally {
    await prisma.$disconnect();
    console.log('--- Test Complete ---');
    process.exit(0);
  }
}

testToggle();
