import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const { pathname } = request.nextUrl;

  const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/register');
  const isApi = pathname.startsWith('/api');
  const isStatic = pathname.startsWith('/_next') || pathname.includes('.');

  // Protect all non-auth and non-api routes
  if (!token && !isAuthPage && !isApi && !isStatic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Prevent logged-in users from accessing /login
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
