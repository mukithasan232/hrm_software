import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { connectDB } from './src/config/db';
import authRoutes from './src/routes/authRoutes';
import attendanceRoutes from './src/routes/attendanceRoutes';
import userRoutes from './src/routes/userRoutes';
import payrollRoutes from './src/routes/payrollRoutes';
import leaveRoutes from './src/routes/leaveRoutes';
import notificationRoutes from './src/routes/notificationRoutes';
import performanceRoutes from './src/routes/performanceRoutes';
import { initCronJobs } from './src/jobs/cronJob';

dotenv.config();

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve uploaded avatars statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/users', userRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/performance', performanceRoutes);

// Basic health check route
app.get('/', (req, res) => {
  res.send('HRM API is running...');
});

// Initialize Server & Database
const startServer = async () => {
  await connectDB();
  
  // Initialize Background Jobs
  initCronJobs();
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
  });
};

startServer();
