export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
// import { prisma } from '@/lib/prisma'; // আপনার প্রিজমা ক্লায়েন্ট ইমপোর্ট করে নেবেন

export async function POST(req: Request) {
  try {
    // লোকাল পিসি থেকে পাঠানো সিক্রেট টোকেন চেক করা (যাতে যে কেউ ডাটা পাঠাতে না পারে)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== 'Bearer my_secret_token_2026') {
      return NextResponse.json({ error: 'Unauthorized Hacker!' }, { status: 401 });
    }

    // বডি থেকে লগগুলো রিসিভ করা
    const body = await req.json();
    const { logs } = body;

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'No logs found' }, { status: 400 });
    }

    console.log(`✅ Webhook hit! Received ${logs.length} logs from local agent.`);

    // --- ডাটাবেসে সেভ করার লজিক (আপনার Prisma Schema অনুযায়ী ঠিক করে নেবেন) ---
    /* 
    for (const log of logs) {
      await prisma.attendanceLog.create({
        data: {
           userId: log.uid, // বা আপনার মেশিনের ইউজার আইডি
           timestamp: new Date(log.recordTime),
           // ... অন্যান্য ফিল্ড
        }
      });
    }
    */

    return NextResponse.json({ success: true, message: `Successfully saved ${logs.length} logs` });

  } catch (error) {
    console.error("Webhook Error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}