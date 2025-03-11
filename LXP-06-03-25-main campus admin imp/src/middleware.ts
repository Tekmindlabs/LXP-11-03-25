import { NextRequest, NextResponse } from 'next/server';
import { logger } from './server/api/utils/logger';
import { setCSRFHeaders } from './server/api/utils/csrf';

/**
 * Validates a session based on cookie existence
 * Note: This is a simplified validation for middleware
 * Full validation happens in API routes
 * 
 * @param sessionId - Session ID to validate
 * @returns Whether the session appears valid
 */
function validateSessionCookie(sessionId: string): boolean {
  try {
    // Basic validation - check if the session ID is a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(sessionId);
  } catch (error) {
    logger.error('Error validating session in middleware', { error });
    return false;
  }
}

/**
 * Checks if a route requires authentication
 * @param pathname - Route path
 * @returns Whether the route requires authentication
 */
function isProtectedRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/teacher') ||
    pathname.startsWith('/student') ||
    pathname.startsWith('/parent') ||
    pathname.includes('/(roles)/')
  );
}

/**
 * Middleware function
 * Handles authentication and security headers
 */
export async function middleware(request: NextRequest) {
  try {
    const path = request.nextUrl.pathname;
    
    // Skip middleware for API routes and static files
    if (
      path.startsWith('/api') ||
      path.startsWith('/_next') ||
      path.startsWith('/static') ||
      path.includes('.') // Static files like favicon.ico
    ) {
      return NextResponse.next();
    }

    // Create response
    const response = NextResponse.next();
    
    // Add security headers
    setCSRFHeaders(response);
    
    // Debug session information
    const sessionCookie = request.cookies.get('session');
    logger.debug('Session information in middleware', {
      path,
      hasSessionCookie: !!sessionCookie,
      sessionCookieValue: sessionCookie ? `${sessionCookie.value.substring(0, 8)}...` : null
    });

    // Check if the route requires authentication
    if (isProtectedRoute(path)) {
      // Simple cookie-based check for middleware
      // Full validation happens in API routes
      const isAuthenticated = sessionCookie ? 
        validateSessionCookie(sessionCookie.value) : false;

      if (!isAuthenticated) {
        // Redirect to login page with callback URL
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    return response;
  } catch (error) {
    logger.error('Error in middleware', { error });
    return NextResponse.next();
  }
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}; 