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

