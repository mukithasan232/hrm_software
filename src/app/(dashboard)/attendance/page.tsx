import { redirect } from 'next/navigation';
import AttendancePageClient from './AttendanceClient';

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedSearchParams = await searchParams;
  
  // 1. Force redirect if range is missing
  if (!resolvedSearchParams.range) {
    redirect('/attendance?range=today');
  }

  // 2. Render the client component
  return <AttendancePageClient />;
}
