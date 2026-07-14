import { redirect } from 'next/navigation';

// This root page now simply redirects to the main dashboard.
export default function RootPage() {
    redirect('/dashboard');
}