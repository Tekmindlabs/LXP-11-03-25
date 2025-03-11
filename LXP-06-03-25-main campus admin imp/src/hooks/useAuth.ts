/**
 * Authentication Hook
 * Provides authentication functionality for client components
 */

'use client';

import { useRouter, usePathname } from "next/navigation";
import { api } from "@/utils/api";
import { TRPCClientError } from "@trpc/client";
import { parseTRPCError } from "@/utils/trpc-error-handler";
import { useState, useEffect } from "react";
import { toast } from '@/components/ui/feedback/toast';
import { useQueryClient } from "@tanstack/react-query";
import { AccessScope } from "../server/api/types/user";

// Add missing type definitions at the top
export type Permission = string; // Define more specific permissions if needed

export enum UserType {
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
  SYSTEM_MANAGER = 'SYSTEM_MANAGER',
  CAMPUS_ADMIN = 'CAMPUS_ADMIN',
  CAMPUS_COORDINATOR = 'CAMPUS_COORDINATOR',
  CAMPUS_TEACHER = 'CAMPUS_TEACHER',
  CAMPUS_STUDENT = 'CAMPUS_STUDENT',
  CAMPUS_PARENT = 'CAMPUS_PARENT'
}

/**
 * User type
 */
export interface User {
  id: string;
  name: string | null;
  email: string;
  username: string;
  userType: UserType;
  status: string;
  institutionId?: string;
  lastLoginAt?: Date;
  permissions: string[]; // Changed from Permission[] to string[]
  primaryCampusId: string | null;
  accessScope: AccessScope;
  activeCampuses: {
    id: string;
    campusId: string;
    roleType: UserType;
  }[];
}

/**
 * Login input type
 */
export interface LoginInput {
  username: string;
  password: string;
  clearExistingSessions?: boolean;
  csrfToken: string;
}

/**
 * Register input type
 */
export interface RegisterInput {
  name: string;
  email: string;
  username: string;
  password: string;
  userType: string;
  institutionId?: string;
  csrfToken: string;
}

/**
 * Authentication response type
 */
interface AuthResponse {
  success: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    username: string;
    userType: string;
  };
  sessionId: string;
}

/**
 * Authentication hook
 */
export function useAuth() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);

  // Check if we're in an auth route to prevent unnecessary queries
  const isAuthRoute = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/register') || 
                     pathname?.startsWith('/forgot-password') ||
                     pathname === '/';
  
  // Initialize loading to false on auth routes to prevent disabling inputs
  const [loading, setLoading] = useState(!isAuthRoute);
  const [localLoading, setLocalLoading] = useState(false);

  const queryClient = useQueryClient();
  
  // Use suspense: false and enabled: true to fetch profile on mount
  const profileQuery = api.auth.getSession.useQuery(undefined, {
    retry: false,
    suspense: false,
    enabled: !isAuthRoute, // Only fetch profile if not on auth routes
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    onError: (error: unknown) => {
      // Silently handle unauthorized errors
      if (error instanceof TRPCClientError && error.message.includes('UNAUTHORIZED')) {
        console.log('User not authenticated, skipping profile fetch');
        // If on a protected route, redirect to login
        if (typeof window !== 'undefined' && 
            !isAuthRoute) {
          router.push('/login');
        }
      }
    },
    onSuccess: (data: { user: User | null }) => {
      if (data?.user) {
        setUser(data.user);
      }
      // Always set loading to false after query completes
      setLoading(false);
    }
  });

  // CSRF token query
  const csrfQuery = api.auth.getCSRFToken.useQuery(undefined, {
    retry: false,
    suspense: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
  });

  // Set up mutations
  const loginMutation = api.auth.login.useMutation();
  const logoutMutation = api.auth.logout.useMutation();
  const registerMutation = api.auth.register.useMutation();
  const forgotPasswordMutation = api.auth.forgotPassword.useMutation();
  const resetPasswordMutation = api.auth.resetPassword.useMutation();
  const changePasswordMutation = api.auth.changePassword.useMutation();

  // Helper function to redirect based on user type
  const redirectToUserDashboard = (userType: string) => {
    switch (userType) {
      case 'ADMIN':
        router.push('/admin/dashboard');
        break;
      case 'TEACHER':
        router.push('/teacher/dashboard');
        break;
      case 'STUDENT':
        router.push('/student/dashboard');
        break;
      case 'PARENT':
        router.push('/parent/dashboard');
        break;
      default:
        router.push('/dashboard');
    }
  };

  // Check if user is authenticated on mount
  useEffect(() => {
    if (!isAuthRoute) {
      if (profileQuery.isLoading) {
        setLoading(true);
      } else {
        setLoading(false);
      }
    } else {
      setLoading(false); // Always set to false on auth routes
    }
  }, [profileQuery.isLoading, isAuthRoute]);

  // Login function
  const login = async (input: LoginInput) => {
    try {
      setLocalLoading(true);
      
      // Only log in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('Login attempt with:', { ...input, password: '***' });
      }
      
      // Call login mutation
      const result = await loginMutation.mutateAsync(input);
      
      // Set user data from result with proper type casting
      if (result.user) {
        const userData: User = {
          ...result.user,
          status: 'ACTIVE',
          permissions: result.user.permissions.map(String) || [], // Ensure permissions is string[]
          accessScope: result.user.accessScope || { global: false, institutions: [], campuses: [] },
          activeCampuses: result.user.activeCampuses || []
        };
        
        setUser(userData);
        
        // Store user info in localStorage for development mode fallback
        if (process.env.NODE_ENV === 'development') {
          localStorage.setItem('user', JSON.stringify({
            id: result.user.id,
            username: result.user.username,
            userType: result.user.userType,
            isAuthenticated: true
          }));
        }
        
        // Show success message
        toast({
          title: "Login successful",
          description: `Welcome back, ${result.user.name || result.user.username}!`,
          variant: "success",
        });
        
        // Redirect based on user type
        redirectToUserDashboard(result.user.userType);
      }
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({ queryKey: [['auth', 'getSession']] });
      
      return result;
    } catch (error) {
      console.error('Login error:', error);
      
      // Show error message
      toast({
        title: "Login failed",
        description: error instanceof Error ? error.message : "An error occurred during login",
        variant: "error",
      });
      
      throw error;
    } finally {
      setLocalLoading(false);
    }
  };

  // Register function
  const register = async (input: Omit<RegisterInput, 'csrfToken'>) => {
    try {
      setLocalLoading(true);
      
      // Get CSRF token
      const csrfTokenData = csrfQuery.data;
      if (!csrfTokenData) {
        throw new Error('Failed to get CSRF token');
      }
      
      // Wait for the CSRF token Promise to resolve
      const csrfToken = await csrfTokenData.csrfToken;
      
      // Add CSRF token to input and cast userType to the expected enum
      const registerInput = {
        ...input,
        csrfToken
      };
      
      const response = await registerMutation.mutateAsync(registerInput as any);
      router.push("/login?registered=true");
      // Show success message
      toast({
        title: "Registration successful",
        description: "Your account has been created. Please log in.",
        variant: "success",
      });
      return response;
    } catch (error) {
      console.error('Registration error:', error);
      toast({
        title: "Registration failed",
        description: error instanceof Error ? error.message : "An error occurred during registration",
        variant: "error",
      });
      throw error;
    } finally {
      setLocalLoading(false);
    }
  };

  // Logout function
  const logout = async (redirectUrl = '/login') => {
    try {
      setLocalLoading(true);
      await logoutMutation.mutateAsync();
      
      // Clear user state
      setUser(null);
      
      // Clear localStorage in development mode
      if (process.env.NODE_ENV === 'development') {
        localStorage.removeItem('user');
      }
      
      // Redirect to login page
      router.push(redirectUrl);
      
      // Show success message
      toast({
        title: "Logout successful",
        description: "You have been logged out.",
        variant: "success",
      });
    } catch (error) {
      console.error('Logout error:', error);
      toast({
        title: "Logout failed",
        description: error instanceof Error ? error.message : "An error occurred during logout",
        variant: "error",
      });
    } finally {
      setLocalLoading(false);
    }
  };

  // Change password function
  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      setLocalLoading(true);
      
      // Get CSRF token
      const csrfTokenData = csrfQuery.data;
      if (!csrfTokenData) {
        throw new Error('Failed to get CSRF token');
      }
      
      // Wait for the CSRF token Promise to resolve
      const csrfToken = await csrfTokenData.csrfToken;
      
      await changePasswordMutation.mutateAsync({
        currentPassword,
        newPassword,
        csrfToken
      });
      
      toast({
        title: "Password changed",
        description: "Your password has been updated successfully.",
        variant: "success",
      });
      
      return true;
    } catch (error) {
      console.error("Password change error:", error);
      
      toast({
        title: "Password change failed",
        description: error instanceof Error ? error.message : "An error occurred while changing your password",
        variant: "error",
      });
      
      return false;
    } finally {
      setLocalLoading(false);
    }
  };

  // Reset password function
  const resetPassword = async (token: string, newPassword: string) => {
    try {
      setLocalLoading(true);
      
      // Get CSRF token
      const csrfTokenData = csrfQuery.data;
      if (!csrfTokenData) {
        throw new Error('Failed to get CSRF token');
      }
      
      // Wait for the CSRF token Promise to resolve
      const csrfToken = await csrfTokenData.csrfToken;
      
      await resetPasswordMutation.mutateAsync({
        token,
        password: newPassword,
        csrfToken
      });
      
      toast({
        title: "Password reset",
        description: "Your password has been reset successfully. Please log in.",
        variant: "success",
      });
      
      router.push('/login?reset=true');
      return true;
    } catch (error) {
      console.error("Password reset error:", error);
      
      toast({
        title: "Password reset failed",
        description: error instanceof Error ? error.message : "An error occurred while resetting your password",
        variant: "error",
      });
      
      return false;
    } finally {
      setLocalLoading(false);
    }
  };

  // Request password reset function
  const requestPasswordReset = async (email: string) => {
    try {
      setLocalLoading(true);
      
      // Get CSRF token
      const csrfTokenData = csrfQuery.data;
      if (!csrfTokenData) {
        throw new Error('Failed to get CSRF token');
      }
      
      // Wait for the CSRF token Promise to resolve
      const csrfToken = await csrfTokenData.csrfToken;
      
      await forgotPasswordMutation.mutateAsync({
        email,
        csrfToken
      });
      
      toast({
        title: "Password reset requested",
        description: "If an account exists with that email, you will receive a password reset link.",
        variant: "success",
      });
      
      return true;
    } catch (error) {
      console.error("Password reset request error:", error);
      
      // Don't show specific errors for security reasons
      toast({
        title: "Password reset requested",
        description: "If an account exists with that email, you will receive a password reset link.",
        variant: "success",
      });
      
      return false;
    } finally {
      setLocalLoading(false);
    }
  };

  return {
    user,
    loading: loading || localLoading,
    isLoading: loading || localLoading,
    login,
    logout,
    register,
    changePassword,
    resetPassword,
    requestPasswordReset,
    isAuthenticated: !!user,
  };
} 
