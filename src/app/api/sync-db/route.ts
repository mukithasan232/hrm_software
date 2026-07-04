import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { stdout, stderr } = await execPromise('npx prisma db push --accept-data-loss');
    
    return NextResponse.json({ 
      success: true, 
      message: "Database schema has been successfully pushed and synced!",
      output: stdout,
      stderr: stderr
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'SYNC_FAILED',
      message: error.message,
      stdout: error.stdout?.toString(),
      stderr: error.stderr?.toString()
    }, { status: 500 });
  }
}
