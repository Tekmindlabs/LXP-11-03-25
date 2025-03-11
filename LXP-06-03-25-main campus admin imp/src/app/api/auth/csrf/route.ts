import { NextResponse } from 'next/server';
import { generateCSRFToken, CSRF_COOKIE_NAME } from '@/server/api/utils/csrf';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    // Generate a new CSRF token
    const csrfToken = await generateCSRFToken();
    
    // Create the response with the token
    const response = NextResponse.json({ csrfToken });
    
    // Set the cookie using Next.js Response cookies
    response.cookies.set({
      name: CSRF_COOKIE_NAME,
      value: csrfToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 // 24 hours
    });
    
    return response;
  } catch (error) {
    console.error('Error generating CSRF token:', error);
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    );
  }
} 