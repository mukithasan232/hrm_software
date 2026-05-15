import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { User } from '../models/User';

async function testLogin() {
  const uri = process.env.MONGO_URI;
  if (!uri) return console.log('No URI');
  
  await mongoose.connect(uri);
  console.log('Connected.');

  const email = 'aiden.khan@hrm.test';
  const pass = 'password123';

  const user = await User.findOne({ email });
  if (!user) {
    console.log('User not found:', email);
  } else {
    const isMatch = await bcrypt.compare(pass, user.password);
    console.log('Login Result for', email, ':', isMatch ? 'SUCCESS' : 'FAILED');
  }

  await mongoose.disconnect();
}

testLogin();
