import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';
import { prisma } from '../lib/prisma';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function testLogin() {
  console.log('Testing login via Prisma...');

  const email = 'aiden.khan@hrm.test';
  const pass = 'password123';

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user) {
    console.log('User not found:', email);
  } else {
    const isMatch = await bcrypt.compare(pass, user.password);
    console.log('Login Result for', email, ':', isMatch ? 'SUCCESS' : 'FAILED');
  }

  await prisma.$disconnect();
}

testLogin();

