const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDb() {
  try {
    const result = await prisma.attendanceLog.updateMany({
      where: {
        punchType: 'UNKNOWN'
      },
      data: {
        punchType: 'CheckIn'
      }
    });
    console.log(`Successfully updated ${result.count} records from 'UNKNOWN' to 'CheckIn'.`);
    
    // Also check for 'Unknown' just in case of case-sensitivity differences
    const result2 = await prisma.attendanceLog.updateMany({
      where: {
        punchType: 'Unknown'
      },
      data: {
        punchType: 'CheckIn'
      }
    });
    console.log(`Successfully updated ${result2.count} records from 'Unknown' to 'CheckIn'.`);
  } catch (error) {
    console.error('Error fixing DB:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixDb();
