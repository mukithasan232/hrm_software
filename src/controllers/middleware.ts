import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Check if the essential DATABASE_URL is present in environment variables.
    // This is our "setup complete" flag.
    const isSetupComplete = !!process.env.DATABASE_URL;

    // Allow access to static files, Next.js internals, and API routes for the setup wizard.
    if (pathname.startsWith('/_next/') || pathname.startsWith('/api/setup/') || pathname.includes('.')) {
        return NextResponse.next();
    }

    if (isSetupComplete) {
        // If setup is complete, but the user is trying to access the onboarding page,
        // redirect them to the login page.
        if (pathname === '/onboarding') {
            const url = request.nextUrl.clone();
            url.pathname = '/login';
            return NextResponse.redirect(url);
        }
    } else {
        // If setup is NOT complete and the user is not on the onboarding page,
        // redirect them to it.
        if (pathname !== '/onboarding') {
            return NextResponse.redirect(new URL('/onboarding', request.url));
        }
    }

    return NextResponse.next();
}