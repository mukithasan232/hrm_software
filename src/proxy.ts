import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Read the token from cookies
  const token = request.cookies.get('token')?.value;

  // Protect /dashboard routes
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) {
      // If there is no token, redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Prevent logged-in users from accessing /login or /
  if (request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  return NextResponse.next();
}

// Specify the paths the middleware should run on
export const config = {
  matcher: ['/dashboard/:path*', '/login', '/'],
};
