import { TRPCError } from "@trpc/server";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { AuthService } from "../services/auth.service";
import { logger } from "../utils/logger";
import { z } from "zod";
import { withRateLimit } from "../middleware/rate-limit.middleware";
import { SessionManager } from "../utils/session-manager";
import { generateCSRFToken, validateCSRFToken, CSRF_COOKIE_NAME } from "../utils/csrf";
import { UserType } from "../constants";

/**
 * Authentication Router
 * Handles authentication-related API endpoints
 */

// Input validation schemas
const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  clearExistingSessions: z.boolean().optional().default(false),
  csrfToken: z.string().min(1, "CSRF token is required")
});

const registerSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  userType: z.enum(["USER", "ADMIN", "TEACHER", "STUDENT", "PARENT"]),
  institutionId: z.string().optional(),
  csrfToken: z.string().min(1, "CSRF token is required")
});

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  csrfToken: z.string().min(1, "CSRF token is required")
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  csrfToken: z.string().min(1, "CSRF token is required")
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  csrfToken: z.string().min(1, "CSRF token is required")
});

/**
 * Authentication Router Implementation
 */
export const authRouter = createTRPCRouter({
  /**
   * Register a new user
   */
  register: publicProcedure
    .input(registerSchema)
    .meta({ rateLimit: { points: 5, duration: 60 * 60 } }) // 5 attempts per hour
    .mutation(async ({ ctx, input }) => {
      try {
        logger.info("Registration attempt", { username: input.username, email: input.email });
        
        // Validate CSRF token
        const isValidToken = await validateCSRFToken(input.csrfToken);
        if (!isValidToken) {
          logger.warn("Invalid CSRF token during registration", { username: input.username });
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid CSRF token",
          });
        }
        
        const authService = new AuthService(ctx.prisma);
        const { csrfToken, ...userData } = input;
        
        // Convert string userType to enum
        const userDataWithEnum = {
          ...userData,
          userType: userData.userType as unknown as UserType,
          institutionId: userData.institutionId || '',
        };
        
        const result = await authService.register(userDataWithEnum);
        
        logger.info("Registration successful", { username: input.username });
        
        return result;
      } catch (error) {
        logger.error("Registration error", { error });
        throw error;
      }
    }),
  
  /**
   * Login a user
   */
  login: publicProcedure
    .meta({ 
      withRateLimit: { limit: 10, timeWindow: 15 * 60 * 1000 } // 10 attempts per 15 minutes
    })
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        logger.info("Login attempt started", { 
          username: input.username,
          hasCSRFToken: !!input.csrfToken,
          hasResponse: !!ctx.res
        });

        // Validate CSRF token
        const isValidToken = await validateCSRFToken(input.csrfToken);
        if (!isValidToken) {
          logger.warn("Invalid CSRF token during login", { 
            username: input.username 
          });
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid CSRF token",
          });
        }
        
        const authService = new AuthService(ctx.prisma);
        const { csrfToken, ...loginData } = input;
        
        // Login and get session
        const result = await authService.login(loginData, ctx.res);
        
        // Generate a new CSRF token for the authenticated session
        const newCsrfToken = await generateCSRFToken();
        
        // Set the new CSRF token cookie using Next.js Response
        if (ctx.res instanceof Response) {
          (ctx.res as any).cookies.set(CSRF_COOKIE_NAME, newCsrfToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 24 * 60 * 60 // 24 hours
          });
        }
        
        logger.info("User logged in successfully", { 
          userId: result.user.id,
          username: input.username,
          hasNewCsrfToken: !!newCsrfToken
        });
        
        return {
          success: true,
          user: result.user,
          sessionId: result.sessionId,
          csrfToken: newCsrfToken
        };
      } catch (error) {
        logger.error("Login error", { 
          error,
          username: input.username,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });

        // Rethrow as TRPC error with appropriate code
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Login failed",
          cause: error
        });
      }
    }),
  
  /**
   * Logout a user
   */
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        if (!ctx.session?.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          });
        }
        
        const authService = new AuthService(ctx.prisma);
        await authService.logout(ctx.session.userId);
        
        logger.info("User logged out successfully", { userId: ctx.session.userId });
        
        return {
          success: true
        };
      } catch (error) {
        logger.error("Logout error", { error });
        throw error;
      }
    }),
  
  /**
   * Get current session
   */
  getSession: publicProcedure
    .query(async ({ ctx }) => {
      try {
        if (!ctx.session?.userId) {
          return { user: null };
        }
        
        const user = await ctx.prisma.user.findUnique({
          where: { id: ctx.session.userId },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            userType: true,
            status: true,
            institutionId: true,
            lastLoginAt: true
          }
        });
        
        if (!user) {
          return { user: null };
        }
        
        return { user };
      } catch (error) {
        logger.error("Get session error", { error });
        throw error;
      }
    }),
  
  /**
   * Forgot password
   */
  forgotPassword: publicProcedure
    .meta({ 
      withRateLimit: { limit: 3, timeWindow: 60 * 60 * 1000 } // 3 attempts per hour
    })
    .input(forgotPasswordSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        // Validate CSRF token
        if (!validateCSRFToken(input.csrfToken)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid CSRF token",
          });
        }
        
        const authService = new AuthService(ctx.prisma);
        const { csrfToken, ...forgotPasswordData } = input;
        
        const result = await authService.forgotPassword(forgotPasswordData);
        
        logger.info("Password reset requested", { email: input.email });
        
        return result;
      } catch (error) {
        logger.error("Forgot password error", { error });
        throw error;
      }
    }),
  
  /**
   * Reset password
   */
  resetPassword: publicProcedure
    .input(resetPasswordSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        logger.info("Password reset attempt");
        
        // Validate CSRF token
        const isValidToken = await validateCSRFToken(input.csrfToken);
        if (!isValidToken) {
          logger.warn("Invalid CSRF token during password reset");
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Invalid CSRF token",
          });
        }
        
        const authService = new AuthService(ctx.prisma);
        const { csrfToken, ...resetPasswordData } = input;
        
        // Convert to the format expected by the service
        const serviceInput = {
          resetToken: resetPasswordData.token,
          newPassword: resetPasswordData.password
        };
        
        const result = await authService.resetPassword(serviceInput);
        
        logger.info("Password reset successful");
        
        return result;
      } catch (error) {
        logger.error("Reset password error", { error });
        throw error;
      }
    }),
  
  /**
   * Change password
   */
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        if (!ctx.session?.userId) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Not authenticated",
          });
        }
        
        // Validate CSRF token
        if (!validateCSRFToken(input.csrfToken)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid CSRF token",
          });
        }
        
        const authService = new AuthService(ctx.prisma);
        const { csrfToken, ...changePasswordData } = input;
        
        const result = await authService.changePassword(ctx.session.userId, changePasswordData);
        
        logger.info("Password changed successfully", { userId: ctx.session.userId });
        
        return result;
      } catch (error) {
        logger.error("Change password error", { error });
        throw error;
      }
    }),
  
  /**
   * Generate CSRF token
   */
  getCSRFToken: publicProcedure
    .query(async () => {
      try {
        const csrfToken = await generateCSRFToken();
        
        return {
          csrfToken
        };
      } catch (error) {
        logger.error("CSRF token generation error", { error });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate CSRF token",
        });
      }
    })
}); 