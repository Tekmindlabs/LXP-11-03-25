/**
 * Authentication Service
 * Handles user authentication, registration, and password management
 */

import { TRPCError } from "@trpc/server";
import { hash, compare } from "bcryptjs";
import { randomBytes } from 'crypto';
import { PrismaClient } from "@prisma/client";
import { UserType, AccessScope, SystemStatus, SYSTEM_CONFIG } from "../constants";
import { hashPassword, verifyPassword } from "../utils/auth";
import crypto from "crypto";
import { SessionManager } from "../utils/session-manager";
import { logger } from '../utils/logger';
import { 
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  updateProfileSchema
} from '../schemas/auth';
import { z } from "zod";

// Define input types based on the schemas
type LoginInput = z.infer<typeof loginSchema>;
type RegisterInput = z.infer<typeof registerSchema>;
type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

interface AuthServiceConfig {
  prisma: PrismaClient;
  saltRounds?: number;
  resetTokenExpiryHours?: number;
}

interface Permission {
  id: string;
  code: string;
  scope: AccessScope;
}

interface AuthenticatedUser {
  id: string;
  name: string | null;
  email: string;
  username: string;
  userType: UserType;
  institutionId: string;
  permissions: Permission[];
  primaryCampusId: string | null;
  accessScope: AccessScope;
  activeCampuses: { id: string; campusId: string; roleType: UserType }[];
}

export class AuthService {
  private prisma: PrismaClient;
  private saltRounds: number;
  private resetTokenExpiryHours: number;

  constructor(config: AuthServiceConfig) {
    this.prisma = config.prisma;
    this.saltRounds = config.saltRounds ?? 10;
    this.resetTokenExpiryHours = config.resetTokenExpiryHours ?? 24;
  }

  /**
   * Register a new user
   */
  async register(input: RegisterInput) {
    try {
      logger.debug('Registering new user', { email: input.email });
      
      // Check if username or email already exists
      const existingUser = await this.prisma.user.findFirst({
        where: {
          OR: [
            { username: input.username },
            { email: input.email },
          ],
          institutionId: input.institutionId,
        },
      });

      if (existingUser) {
        if (existingUser.email === input.email) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Email already in use'
          });
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Username already taken'
          });
        }
      }

      // Hash password
      const hashedPassword = await hash(input.password, this.saltRounds);

      // Create user
      const user = await this.prisma.user.create({
        data: {
          name: input.name,
          email: input.email,
          username: input.username,
          password: hashedPassword,
          phoneNumber: input.phoneNumber,
          userType: input.userType as UserType,
          institutionId: input.institutionId,
          profileData: input.profileData as any,
          status: SystemStatus.ACTIVE,
          accessScope: AccessScope.SINGLE_CAMPUS,
        },
      });

      // Return user without password
      const { password, ...userWithoutPassword } = user;
      
      logger.info('User registered successfully', { 
        userId: user.id,
        email: user.email
      });
      
      return userWithoutPassword;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      
      logger.error('Error registering user', { error, email: input.email });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to register user'
      });
    }
  }

  /**
   * Validate user credentials
   */
  private async validateCredentials(credentials: LoginInput): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: {
        username: credentials.username,
        status: SystemStatus.ACTIVE,
      },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        activeCampuses: true,
      },
    });

    if (!user || !user.password) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid credentials",
      });
    }

    const isPasswordValid = await verifyPassword(credentials.password, user.password);
    if (!isPasswordValid) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid credentials",
      });
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email || "",
      username: user.username,
      userType: user.userType as UserType,
      institutionId: user.institutionId,
      permissions: user.permissions.map((p: any) => ({
        id: p.permission.id,
        code: p.permission.code,
        scope: p.permission.scope as AccessScope,
      })),
      activeCampuses: user.activeCampuses.map((c: any) => ({
        id: c.id,
        campusId: c.campusId,
        roleType: c.roleType as UserType,
      })),
      primaryCampusId: user.primaryCampusId,
      accessScope: user.accessScope as AccessScope,
    };
  }

  /**
   * Login a user
   */
  async login(input: LoginInput, res?: Response) {
    try {
      logger.debug('User login attempt', { username: input.username });
      
      const user = await this.validateCredentials(input);
      
      // Use the SessionManager to clear any existing sessions for this user
      const sessionManager = new SessionManager(this.prisma);
      await sessionManager.clearUserSessions(user.id);
      
      // Create new session using the SessionManager
      const sessionId = await sessionManager.createSession(user.id, user.userType);
      
      // Set session cookie if response object is provided
      if (res) {
        sessionManager.setSessionCookie(res, sessionId);
      }
      
      // Update last login timestamp
      await this.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() }
      });
      
      logger.info('User logged in successfully', { 
        userId: user.id,
        sessionId
      });
      
      return {
        user,
        sessionId,
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      
      logger.error('Error during login', { error, username: input.username });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Login failed'
      });
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        permissions: {
          include: {
            permission: true,
          },
        },
        activeCampuses: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    // Map user to authenticated user format
    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      name: user.name,
      email: user.email || "",
      username: user.username,
      userType: user.userType as UserType,
      institutionId: user.institutionId,
      permissions: user.permissions.map((p: any) => ({
        id: p.permission.id,
        code: p.permission.code,
        scope: p.permission.scope as AccessScope,
      })),
      activeCampuses: user.activeCampuses.map((c: any) => ({
        id: c.id,
        campusId: c.campusId,
        roleType: c.roleType as UserType,
      })),
      primaryCampusId: user.primaryCampusId,
      accessScope: user.accessScope as AccessScope,
    };

    return authenticatedUser;
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: string, input: UpdateProfileInput) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        updatedAt: new Date(),
        name: input.name,
        phoneNumber: input.phoneNumber,
        dateOfBirth: input.dateOfBirth,
        profileData: input.profileData as any,
      },
    });

    return updatedUser;
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, input: ChangePasswordInput): Promise<{ message: string }> {
    try {
      logger.debug('Password change requested', { userId });
      
      // Find user
      const user = await this.prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }
      
      // Verify current password
      const isPasswordValid = await compare(input.currentPassword, user.password);
      if (!isPasswordValid) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Current password is incorrect'
        });
      }
      
      // Hash new password
      const hashedPassword = await hash(input.newPassword, this.saltRounds);
      
      // Update password
      await this.prisma.user.update({
        where: { id: userId },
        data: { password: hashedPassword }
      });
      
      logger.info('Password changed successfully', { userId });
      
      return {
        message: 'Password changed successfully'
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      
      logger.error('Error changing password', { error, userId });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to change password'
      });
    }
  }

  /**
   * Create user profile based on user type
   */
  private async createUserProfile(user: { id: string; userType: UserType }) {
    switch (user.userType) {
      case UserType.CAMPUS_STUDENT:
        await this.prisma.studentProfile.create({
          data: {
            userId: user.id,
            enrollmentNumber: await this.generateEnrollmentNumber(),
          },
        });
        break;

      case UserType.CAMPUS_TEACHER:
        await this.prisma.teacherProfile.create({
          data: {
            userId: user.id,
          },
        });
        break;

      case UserType.CAMPUS_COORDINATOR:
        await this.prisma.coordinatorProfile.create({
          data: {
            userId: user.id,
          },
        });
        break;
    }
  }

  /**
   * Generate unique enrollment number for students
   */
  private async generateEnrollmentNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const count = await this.prisma.studentProfile.count();
    const sequence = (count + 1).toString().padStart(4, "0");
    return `ST${year}${sequence}`;
  }

  /**
   * Initiate password reset process
   */
  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    try {
      logger.debug('Password reset requested', { email: input.email });
      
      // Find user by email
      const user = await this.prisma.user.findUnique({
        where: { email: input.email }
      });
      
      // If user not found, still return success to prevent email enumeration
      if (!user || user.status !== SystemStatus.ACTIVE) {
        logger.debug('Password reset requested for non-existent or inactive user', { 
          email: input.email,
          exists: !!user,
          status: user?.status
        });
        
        return {
          message: 'If your email is registered, you will receive a password reset link'
        };
      }
      
      // Generate reset token
      const resetToken = randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date();
      resetTokenExpiry.setHours(resetTokenExpiry.getHours() + this.resetTokenExpiryHours);
      
      // Save reset token to database
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken,
          resetTokenExpiry
        }
      });
      
      // In a real application, send email with reset link
      // For now, just log the token
      logger.info('Password reset token generated', { 
        userId: user.id,
        resetToken,
        resetTokenExpiry
      });
      
      return {
        message: 'If your email is registered, you will receive a password reset link'
      };
    } catch (error) {
      logger.error('Error processing forgot password request', { error, email: input.email });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to process password reset request'
      });
    }
  }

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    try {
      logger.debug('Password reset attempt', { token: `${input.resetToken.substring(0, 8)}...` });
      
      // Find user by reset token
      const user = await this.prisma.user.findFirst({
        where: {
          resetToken: input.resetToken,
          resetTokenExpiry: {
            gt: new Date()
          }
        }
      });
      
      // Check if token is valid
      if (!user) {
        logger.debug('Password reset failed: Invalid or expired token');
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired reset token'
        });
      }
      
      // Hash new password
      const hashedPassword = await hash(input.newPassword, this.saltRounds);
      
      // Update user password and clear reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null
        }
      });
      
      // Clear all existing sessions for security
      const sessionManager = new SessionManager(this.prisma);
      await sessionManager.clearUserSessions(user.id);
      
      logger.info('Password reset successful', { userId: user.id });
      
      return {
        message: 'Password reset successful. You can now log in with your new password.'
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      
      logger.error('Error resetting password', { error });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to reset password'
      });
    }
  }

  /**
   * Logs out a user
   * @param userId - User ID
   * @param sessionId - Session ID to invalidate
   * @param res - Response object for clearing cookies
   */
  async logout(userId: string, sessionId?: string, res?: Response): Promise<void> {
    try {
      logger.debug('User logout', { userId });
      
      const sessionManager = new SessionManager(this.prisma);
      
      if (sessionId) {
        // Delete specific session
        await this.prisma.session.delete({
          where: { id: sessionId }
        }).catch((error: Error) => {
          logger.error('Error deleting session', { error, sessionId });
        });
      } else {
        // Clear all user sessions
        await sessionManager.clearUserSessions(userId);
      }
      
      // Clear session cookie if response object is provided
      if (res) {
        sessionManager.clearSessionCookie(res);
      }
      
      logger.info('User logged out successfully', { userId });
    } catch (error) {
      logger.error('Error during logout', { error, userId });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Logout failed'
      });
    }
  }
} 
