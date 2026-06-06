export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { parseDhakaTimestamp } from '@/services/zkService';

// ADMS initial handshake or queries
export async function GET(req: Request) {
  return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
}

// ADMS Data Push Endpoint
export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const table = url.searchParams.get('table');
    const rawBody = await req.text();

    console.log(`\n======================================================`);
    console.log(`[ADMS Webhook] 📥 INCOMING PUSH FOR TABLE: ${table}`);
    console.log(`[ADMS Webhook] Payload Size: ${rawBody.length} bytes`);
    console.log(`[ADMS Webhook] Raw Data:\n${rawBody}`);
    console.log(`======================================================\n`);

    // ZKTeco pushes various tables (ATTLOG, OPERLOG, ATTPHOTO). We mainly care about ATTLOG.
    if (table !== 'ATTLOG' && !rawBody.includes('\t')) {
      return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    const lines = rawBody.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const io = (global as any).io;
    const processedLogs: any[] = [];

    for (const line of lines) {
      // Data format: USER_PIN \t TIMESTAMP \t STATUS \t VERIFY_TYPE \t WORKCODE \t RESERVED
      const parts = line.split('\t');
      if (parts.length < 3) continue;

      const deviceUserId = parts[0].trim();
      const recordTime = parts[1].trim();
      const rawStatus = parts[2].trim();
      
      // Safely parse timestamp to UTC+6 (Dhaka Time)
      const dhakaTime = parseDhakaTimestamp(recordTime);

      const strId = String(deviceUserId);
      const numId = !isNaN(Number(strId)) ? parseInt(strId, 10).toString() : strId;
      const paddedId2 = numId.padStart(2, '0');
      const paddedId3 = numId.padStart(3, '0');
      const empPrefix1 = `EMP${numId}`;
      const empPrefix2 = `EMP${paddedId2}`;
      const empPrefix3 = `EMP${paddedId3}`;

      let user = await prisma.user.findFirst({
        where: {
          OR: [
            { employeeId: strId },
            { employeeId: numId },
            { employeeId: paddedId2 },
            { employeeId: paddedId3 },
            { employeeId: empPrefix1 },
            { employeeId: empPrefix2 },
            { employeeId: empPrefix3 },
            { id: strId }
          ]
        },
        select: { id: true, name: true }
      });

      // SMART CHECKIN / CHECKOUT DETECTION
      const tzOffset = 6 * 60 * 60 * 1000;
      const tsBD = new Date(dhakaTime.getTime() + tzOffset);
      const y = tsBD.getUTCFullYear();
      const m = tsBD.getUTCMonth();
      const d = tsBD.getUTCDate();
      
      const startOfDay = new Date(Date.UTC(y, m, d - 1, 18, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(y, m, d, 17, 59, 59, 999));

      let finalPunchType = 'CheckIn';
      
      // Map standard ZKTeco ADMS punch states
      if (['1', '5', 'checkout', 'out'].includes(rawStatus.toLowerCase())) {
        finalPunchType = 'CheckOut';
      } else if (['0', '4', 'checkin', 'in'].includes(rawStatus.toLowerCase())) {
        finalPunchType = 'CheckIn';
      } else {
        // Fallback to time-based logic (first punch of day is CheckIn, subsequent is CheckOut)
        if (user) {
          const firstPunchToday = await prisma.attendanceLog.findFirst({
            where: {
              employeeId: user.id,
              timestamp: { gte: startOfDay, lte: endOfDay }
            },
            orderBy: { timestamp: 'asc' }
          });
          if (firstPunchToday && firstPunchToday.timestamp.getTime() !== dhakaTime.getTime()) {
            finalPunchType = 'CheckOut';
          }
        }
      }

      // Handle unmapped users by saving to rawDeviceLog
      if (!user) {
        await (prisma as any).rawDeviceLog.upsert({
          where: {
            deviceUserId_recordTime: {
              deviceUserId: String(deviceUserId),
              recordTime: dhakaTime
            }
          },
          update: {
            punchType: finalPunchType,
            ip: 'ADMS-Cloud'
          },
          create: {
            deviceUserId: String(deviceUserId),
            recordTime: dhakaTime,
            punchType: finalPunchType,
            ip: 'ADMS-Cloud'
          }
        });
        console.log(`[ADMS Webhook] Saved raw punch for unknown deviceUserId: ${deviceUserId} [${finalPunchType}]`);
        continue;
      }

      // Upsert matched user logs into primary AttendanceLog table
      const log = await prisma.attendanceLog.upsert({
        where: {
          employeeId_timestamp: {
            employeeId: user.id,
            timestamp: dhakaTime
          }
        },
        update: {
          punchType: finalPunchType as any,
          deviceId: 'ADMS-Cloud'
        },
        create: {
          employeeId: user.id,
          timestamp: dhakaTime,
          punchType: finalPunchType as any,
          deviceId: 'ADMS-Cloud'
        }
      });

      const logData = {
        ...log,
        employeeName: user.name
      };

      processedLogs.push(logData);

      // Emit Real-Time Socket Updates to Dashboard
      if (io) {
        setImmediate(() => {
          io.emit('new-attendance', logData);
          io.emit('attendanceUpdate', { checkIn: finalPunchType === 'CheckIn' });
          console.log(`[RealtimeService] 📡 Emitted ADMS live punch: ${logData.employeeName} [${finalPunchType}]`);
        });
      }
    }

    // Required by ZKTeco ADMS to acknowledge receipt and prevent re-sending
    return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });

  } catch (error: any) {
    console.error(`[ADMS Webhook] 🚨 CRITICAL ERROR:`, error);
    // Returning OK even on error to prevent device from endlessly queueing corrupt logs
    return new Response("OK", { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
}
