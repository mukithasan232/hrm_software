import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic'; // Prevent static caching

export default async function SeedAdminPage() {
  try {
    const plainPassword = "Developer@2026!";
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    const email = "dev@fixanyphoto.com";

    // This will run directly on the production server, bypassing local IP blocks
    await prisma.user.upsert({
      where: { email },
      update: {
        roles: {
          connectOrCreate: {
            where: { name: 'SUPER_ADMIN' },
            create: { name: 'SUPER_ADMIN', description: 'Super Administrator' }
          }
        },
        verificationStatus: 'ACTIVE',
        password: hashedPassword,
      },
      create: {
        name: "Developer Admin",
        email: email,
        password: hashedPassword,
        roles: {
          connectOrCreate: {
            where: { name: 'SUPER_ADMIN' },
            create: { name: 'SUPER_ADMIN', description: 'Super Administrator' }
          }
        },
        verificationStatus: 'ACTIVE',
        employeeId: "DEV-9999", 
      }
    });

    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-green-100">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Live Database Seeded!</h1>
          <p className="text-slate-600 mb-6">The Developer Admin account has been successfully created in the production database.</p>
          <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-200 mb-6">
            <p className="text-sm text-slate-700"><strong>Email:</strong> {email}</p>
            <p className="text-sm text-slate-700"><strong>Pass:</strong> Developer@2026!</p>
          </div>
          <a href="/login" className="inline-block bg-blue-600 text-white font-semibold px-6 py-3 rounded-xl hover:bg-blue-700 transition-colors w-full">
            Go to Login
          </a>
        </div>
      </div>
    );
  } catch (error: any) {
    return (
      <div className="p-8 text-center text-red-600">
        <h1 className="text-xl font-bold mb-4">Database Error</h1>
        <pre className="bg-red-50 p-4 rounded-lg text-left overflow-auto">{error.message}</pre>
      </div>
    );
  }
}
