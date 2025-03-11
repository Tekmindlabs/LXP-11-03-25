'use client';

import { useState, useEffect } from 'react';
import { Shell } from './shell';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function AppShellWrapper({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  
  // Check if we're in an auth route
  const isAuthRoute = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/register') || 
                     pathname?.startsWith('/forgot-password') ||
                     pathname === '/';

  // Only use auth hook if not on auth routes to prevent unnecessary queries
  const auth = useAuth();
  const { user, logout, isLoading: authLoading } = isAuthRoute 
    ? { user: null, logout: async () => {}, isLoading: false } 
    : auth;
  
  // Use effect to handle redirects based on auth state
  useEffect(() => {
    try {
      // Skip auth check on auth routes
      if (isAuthRoute) {
        setIsLoading(false);
        return;
      }
      
      if (authLoading) return;
      
      if (user) {
        // If we're at the root, redirect to the appropriate dashboard
        if (pathname === '/') {
          const dashboardPath = user.userType === 'SYSTEM_ADMIN' 
            ? '/admin/system'
            : user.userType === 'CAMPUS_ADMIN'
            ? '/admin/campus'
            : '/dashboard';
          router.push(dashboardPath);
        }
      } else if (!isAuthRoute) {
        // Clear any stale cookies before redirecting - use only our session cookie name
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.split('=');
          if (name.trim() === 'session') {
            document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
          }
        });
        
        router.push('/login');
      }
      
      setIsLoading(false);
    } catch (err) {
      console.error('Error in AppShellWrapper:', err);
      setError('An error occurred while checking authentication status');
      setIsLoading(false);
    }
  }, [user, authLoading, isAuthRoute, pathname, router]);

  // Custom logout handler
  const handleLogout = async () => {
    try {
      // Clear any cookies - use only our session cookie name
      document.cookie.split(';').forEach(cookie => {
        const [name] = cookie.split('=');
        if (name.trim() === 'session') {
          document.cookie = `${name.trim()}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
        }
      });
      
      await logout();
    } catch (err) {
      console.error('Error during logout:', err);
      // Force redirect to login even if logout fails
      router.push('/login');
    }
  };

  // Show loading state while checking auth
  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  // Show error state
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <div className="text-red-500">{error}</div>
        <button 
          onClick={() => router.push('/login')}
          className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        >
          Go to Login
        </button>
      </div>
    );
  }

  // For auth routes, just render the children (no sidebar needed)
  if (isAuthRoute) {
    return children;
  }

  // For authenticated routes (including admin routes), show the shell with navigation
  if (user) {
    return <Shell onLogout={handleLogout}>{children}</Shell>;
  }

  // For all other cases, show the children
  return children;
} 