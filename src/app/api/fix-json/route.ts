import { NextResponse } from 'next/server';
import { prisma } from '@/config/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const queries = [
      // Fix User table
      prisma.$executeRawUnsafe(`UPDATE User SET permissions = '{}' WHERE permissions = '' OR permissions IS NULL;`),
      prisma.$executeRawUnsafe(`UPDATE User SET documents = '{}' WHERE documents = '' OR documents IS NULL;`),
      
      // Fix Designation table
      prisma.$executeRawUnsafe(`UPDATE Designation SET permissions = '{}' WHERE permissions = '' OR permissions IS NULL;`),
      prisma.$executeRawUnsafe(`UPDATE Designation SET weekendDays = '["Sunday"]' WHERE weekendDays = '' OR weekendDays IS NULL;`),
      
      // Fix Role table
      prisma.$executeRawUnsafe(`UPDATE Role SET permissions = '{}' WHERE permissions = '' OR permissions IS NULL;`),
      prisma.$executeRawUnsafe(`UPDATE Role SET weekendDays = '["Sunday"]' WHERE weekendDays = '' OR weekendDays IS NULL;`),
      
      // Fix UserPermission table
      prisma.$executeRawUnsafe(`UPDATE UserPermission SET matrix = '{}' WHERE matrix = '' OR matrix IS NULL;`),
      
      // Fix Task table
      prisma.$executeRawUnsafe(`UPDATE Task SET comments = '[]' WHERE comments = '' OR comments IS NULL;`),
      
      // Fix TenantSettings table
      prisma.$executeRawUnsafe(`UPDATE TenantSettings SET localization = '{}' WHERE localization = '' OR localization IS NULL;`)
    ];

    await Promise.all(queries);

    return NextResponse.json({ 
      success: true, 
      message: "Database JSON fields have been sanitized successfully!"
    });
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: 'SANITIZE_FAILED',
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
