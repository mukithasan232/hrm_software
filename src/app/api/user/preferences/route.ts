import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';

// Define the structure of the decoded JWT payload
interface DecodedToken {
  id: string;
  // other properties from the token...
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ message: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.split(' ')[1];
    let decoded: DecodedToken;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as DecodedToken;
    } catch (error) {
      return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
    }

    const userId = decoded.id;
    if (!userId) {
      return NextResponse.json({ message: 'User ID not found in token' }, { status: 401 });
    }

    const { language, dashboardConfig, taskView } = await req.json();

    // Construct the data payload for Prisma, only including fields that are present
    const dataToUpdate: { language?: string; dashboardConfig?: any; taskView?: string } = {};
    if (language !== undefined) dataToUpdate.language = language;
    if (dashboardConfig !== undefined) dataToUpdate.dashboardConfig = dashboardConfig;
    if (taskView !== undefined) dataToUpdate.taskView = taskView;

    // Prevent updating with empty payload
    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ message: 'No preferences provided to update' }, { status: 400 });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      select: {
        id: true,
        language: true,
        dashboardConfig: true,
        taskView: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('[API/USER/PREFERENCES] Error:', error);
    return NextResponse.json({ message: 'An error occurred while updating preferences.' }, { status: 500 });
  }
}
