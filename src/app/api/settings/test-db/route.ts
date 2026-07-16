import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

export async function POST(req: Request) {
  try {
    const { host, port, user, password, name } = await req.json();

    if (!host || !port || !user || !name) {
      return NextResponse.json({ success: false, message: 'Missing database configuration fields.' }, { status: 400 });
    }

    const connectionString = `mysql://${user}:${password}@${host}:${port}/${name}`;

    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: connectionString,
        },
      },
    });

    await prisma.$connect();
    await prisma.$disconnect();

    return NextResponse.json({ success: true, message: 'Connected successfully' }, { status: 200 });
  } catch (error: any) {
    console.error('Database connection test failed:', error);
    return NextResponse.json({ success: false, message: error.message || 'Database connection failed' }, { status: 400 });
  }
}
