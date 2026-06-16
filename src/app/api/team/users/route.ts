export const dynamic = 'force-dynamic';
export const revalidate = 0;
import { wrapHandler, corsPreflight } from '@/lib/adapter';
import { getEmployees, createEmployee } from '@/controllers/userController';

import { NextResponse } from 'next/server';

export const OPTIONS = corsPreflight;

export const GET = async (req: any, ctx: any) => {
  try {
    const handler = wrapHandler(getEmployees, {
      protect: true,
      allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
    });
    return await handler(req, ctx);
  } catch (error: any) {
    console.error("SERVER_CRASH_LOG:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
};

export const POST = async (req: any, ctx: any) => {
  try {
    const handler = wrapHandler(createEmployee, {
      protect: true,
      allowedDesignations: ['Admin', 'Super Admin', 'System Administrator'],
    });
    return await handler(req, ctx);
  } catch (error: any) {
    console.error("SERVER_CRASH_LOG:", error);
    return NextResponse.json({ message: "Internal Server Error", error: error.message }, { status: 500 });
  }
};
