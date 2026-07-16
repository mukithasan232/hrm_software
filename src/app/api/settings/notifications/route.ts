import { NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { wrapHandler, corsPreflight, parseRequest, getCorsHeaders } from '@/lib/adapter';

export const OPTIONS = corsPreflight;

const getNotificationSettings = async (req: any, res: any) => {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: req.user.id }
    });
    
    if (!dbUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    let prefs = dbUser.notificationPrefs;
    if (typeof prefs === 'string') {
      try {
        prefs = JSON.parse(prefs);
      } catch (e) {
        prefs = {};
      }
    }

    // Return defaults if empty
    if (!prefs || Object.keys(prefs).length === 0) {
      prefs = {
        emailOnLeave: true,
        emailOnTask: true,
        emailOnLate: false,
        emailOnSystemAlert: true
      };
    }

    return res.json(prefs);
  } catch (error: any) {
    console.error('Notification Settings Fetch Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch settings' });
  }
};

export const GET  = wrapHandler(getNotificationSettings,    { protect: true });

export async function POST(req: Request) {
  try {
    const mockReq = await parseRequest(req as any);
    const userId = mockReq.user?.id;

    if (!userId) {
      return NextResponse.json({ success: false, message: "Unauthorized or User ID missing" }, { status: 401, headers: getCorsHeaders() });
    }

    const body = await req.json();

    // UPDATE DATABASE
    await prisma.user.update({
      where: { id: userId },
      data: {
        notificationPrefs: body // Prisma handles JSON conversion automatically if schema is Json?
      }
    });

    return NextResponse.json({ success: true, message: "Preferences updated!" }, { headers: getCorsHeaders() });
  } catch (error) {
    console.error("FAILED TO SAVE PREFS:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500, headers: getCorsHeaders() });
  }
}
