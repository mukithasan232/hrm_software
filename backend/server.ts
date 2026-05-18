import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import { connectDB } from './src/config/db';
import authRoutes from './src/routes/authRoutes';
import attendanceRoutes from './src/routes/attendanceRoutes';
import userRoutes from './src/routes/userRoutes';
import payrollRoutes from './src/routes/payrollRoutes';
import leaveRoutes from './src/routes/leaveRoutes';
import notificationRoutes from './src/routes/notificationRoutes';
import performanceRoutes from './src/routes/performanceRoutes';
import { initCronJobs } from './src/jobs/cronJob';
import { initRealtimeAttendance } from './src/services/realtimeService';

dotenv.config();

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

const app = express();
const server = http.createServer(app);

// Apply CORS at the very beginning
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5001;


// Serve uploaded avatars statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/zkteco', attendanceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/performance', performanceRoutes);

import { prisma } from './src/lib/prisma';

// Temporary Dev Database Cleanup Endpoint
app.get('/api/dev/cleanup-db', async (req, res) => {
  try {
    console.log('🧹 [CleanupDev] Starting database cleanup...');
    
    // 1. Wipe all attendance logs
    const deletedLogs = await prisma.attendanceLog.deleteMany({});
    console.log(`🧹 [CleanupDev] Wiped ${deletedLogs.count} attendance logs.`);

    // 2. Wipe all payroll history
    const deletedPayrolls = await prisma.payroll.deleteMany({});
    console.log(`🧹 [CleanupDev] Wiped ${deletedPayrolls.count} payroll records.`);

    // 3. Identify target test users
    const testUsers = await prisma.user.findMany({
      where: {
        role: { not: 'Admin' },
        employeeId: { startsWith: 'EMP' }
      }
    });

    const userIds = testUsers.map(u => u.id);
    const employeeIds = testUsers.map(u => u.employeeId);

    if (userIds.length > 0) {
      console.log(`🧹 [CleanupDev] Deleting child records for ${testUsers.length} test employees...`);
      await prisma.dailyAttendance.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.leave.deleteMany({ where: { OR: [{ employeeId: { in: userIds } }, { reviewedById: { in: userIds } }] } });
      await prisma.notification.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.payroll.deleteMany({ where: { employeeId: { in: employeeIds } } });
      await prisma.performance.deleteMany({ where: { employeeId: { in: userIds } } });

      const deletedUsers = await prisma.user.deleteMany({
        where: {
          id: { in: userIds }
        }
      });
      console.log(`🧹 [CleanupDev] Wiped ${deletedUsers.count} test employees.`);
    }

    res.status(200).json({
      message: 'Database cleaned successfully',
      deletedLogs: deletedLogs.count,
      deletedUsers: testUsers.length
    });
  } catch (error: any) {
    console.error('❌ [CleanupDev] Error during DB cleanup:', error);
    res.status(500).json({ message: 'Cleanup failed', error: error.message });
  }
});

// Basic health check route
app.get('/', (req, res) => {
  res.send('HRM API is running with Realtime Support...');
});

// Initialize Server & Database
const startServer = async () => {
  await connectDB();
  
  // Initialize Background Jobs
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_CRON === 'true') {
    initCronJobs();
  }
  
  // Initialize Realtime Device Listener
  if (process.env.VERCEL !== '1') {
    server.listen(PORT, () => {
      console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
      
      // Start device sync in background so it doesn't block API startup
      initRealtimeAttendance(io).catch(err => {
        console.error('[Main] Realtime init failed:', err.message);
      });
    });
  }

};

startServer();

export default app;

