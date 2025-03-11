import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';
import { SYSTEM_CONFIG } from '../constants';
import { logger } from './logger';
import type { CustomSession } from '../trpc';

// Define Session interface since it's not exported from Prisma
interface Session {
  id: string;
  userId: string;
  userType: string;
  expires: Date;
  createdAt: Date;
  updatedAt: Date;
  lastActiveAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Session Manager
 * Handles all session-related operations including creation, validation, and cleanup
 */

/**
 * Session manager configuration
 */
interface SessionManagerConfig {
  /**
   * Session duration in days
   * @default 7
   */
  sessionDurationDays?: number;
  
  /**
   * Cookie domain
   * @default undefined (current domain)
   */
  cookieDomain?: string;
  
  /**
   * Whether to secure the cookie (HTTPS only)
   * @default true in production, false otherwise
   */
  secureCookie?: boolean;
}

/**
 * Session manager class
 */
export class SessionManager {
  private prisma: PrismaClient;
  private static readonly SESSION_COOKIE_NAME = 'session';
  private readonly sessionDurationDays: number;
  private readonly cookieDomain?: string;
  private readonly secureCookie: boolean;
  
  /**
   * Cookie options for session cookie
   */
  private get cookieOptions() {
    return {
      httpOnly: true,
      secure: this.secureCookie,
      sameSite: 'lax' as const,
      path: '/',
      domain: this.cookieDomain,
      maxAge: this.sessionDurationDays * 24 * 60 * 60, // in seconds
    };
  }
  
  /**
   * Creates a new session manager
   * @param prisma - Prisma client
   * @param config - Session manager configuration
   */
  constructor(
    prisma: PrismaClient,
    config: SessionManagerConfig = {}
  ) {
    this.prisma = prisma;
    this.sessionDurationDays = config.sessionDurationDays ?? 7;
    this.cookieDomain = config.cookieDomain;
    this.secureCookie = config.secureCookie ?? (process.env.NODE_ENV === 'production');
    
    logger.debug('SessionManager initialized', {
      sessionDurationDays: this.sessionDurationDays,
      cookieDomain: this.cookieDomain,
      secureCookie: this.secureCookie
    });
  }
  
  /**
   * Gets the session ID from a request
   * @param req - Request object
   * @returns Session ID if found, undefined otherwise
   */
  static getSessionIdFromRequest(req: Request): string | undefined {
    try {
      const cookies = req.headers.get('cookie');
      if (!cookies) return undefined;
      
      const sessionCookie = cookies.split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(`${this.SESSION_COOKIE_NAME}=`));
      
      if (!sessionCookie) return undefined;
      
      const sessionId = sessionCookie.split('=')[1];
      return sessionId;
    } catch (error) {
      logger.error('Error getting session ID from request', { error });
      return undefined;
    }
  }
  
  /**
   * Gets the session ID from cookies (client-side)
   * @returns Session ID if found, undefined otherwise
   */
  static async getSessionIdFromCookies(): Promise<string | undefined> {
    try {
      // Server-side
      if (typeof window === 'undefined') {
        try {
          // In newer Next.js versions, cookies() returns a Promise
          const cookieStore = await cookies();
          const sessionCookie = cookieStore.get(SessionManager.SESSION_COOKIE_NAME);
          return sessionCookie?.value;
        } catch (error) {
          logger.error('Error accessing server-side cookies', { error });
          return undefined;
        }
      }
      
      // Client-side
      const clientCookies = document.cookie.split(';')
        .map(cookie => cookie.trim());
      
      const sessionCookie = clientCookies.find(cookie => 
        cookie.startsWith(`${SessionManager.SESSION_COOKIE_NAME}=`)
      );
      
      if (!sessionCookie) return undefined;
      
      return sessionCookie.split('=')[1];
    } catch (error) {
      logger.error('Error getting session ID from cookies', { error });
      return undefined;
    }
  }
  
  /**
   * Creates a new session for a user
   * @param userId - User ID
   * @param userType - User type
   * @returns Session ID
   */
  async createSession(userId: string, userType: string): Promise<string> {
    try {
      logger.debug('Creating new session', { userId, userType });
      
      // Calculate expiration date
      const expires = new Date();
      expires.setDate(expires.getDate() + this.sessionDurationDays);
      
      // Create session in database
      const session = await this.prisma.session.create({
        data: {
          userId,
          userType,
          expires,
        }
      });
      
      logger.debug('Session created successfully', { 
        sessionId: session.id,
        userId,
        expires
      });
      
      return session.id;
    } catch (error) {
      logger.error('Error creating session', { error, userId });
      throw error;
    }
  }
  
  /**
   * Sets the session cookie in the response
   * @param res - Response object
   * @param sessionId - Session ID
   */
  setSessionCookie(res: Response, sessionId: string): void {
    try {
      const cookieValue = `${SessionManager.SESSION_COOKIE_NAME}=${sessionId}`;
      const cookieOptions = Object.entries(this.cookieOptions)
        .map(([key, value]) => {
          if (value === undefined) return '';
          if (typeof value === 'boolean') return value ? key : '';
          return `${key}=${value}`;
        })
        .filter(Boolean)
        .join('; ');
      
      res.headers.set('Set-Cookie', `${cookieValue}; ${cookieOptions}`);
      
      logger.debug('Session cookie set', { sessionId });
    } catch (error) {
      logger.error('Error setting session cookie', { error, sessionId });
      throw error;
    }
  }
  
  /**
   * Clears the session cookie in the response
   * @param res - Response object
   */
  clearSessionCookie(res: Response): void {
    try {
      const cookieValue = `${SessionManager.SESSION_COOKIE_NAME}=; Max-Age=0; Path=/`;
      res.headers.set('Set-Cookie', cookieValue);
      
      logger.debug('Session cookie cleared');
    } catch (error) {
      logger.error('Error clearing session cookie', { error });
      throw error;
    }
  }
  
  /**
   * Validates a session
   * @param sessionId - Session ID
   * @returns Session data if valid, null otherwise
   */
  async validateSession(sessionId: string): Promise<CustomSession | null> {
    try {
      logger.debug('Validating session', { sessionId });
      
      // Find session in database
      const session = await this.prisma.session.findUnique({
        where: { id: sessionId }
      });
      
      // Check if session exists and is not expired
      if (!session || session.expires < new Date()) {
        logger.debug('Session invalid or expired', { 
          sessionId,
          exists: !!session,
          expired: session ? session.expires < new Date() : false
        });
        return null;
      }
      
      // Update session last accessed time
      await this.prisma.session.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() }
      });
      
      logger.debug('Session validated successfully', { 
        sessionId,
        userId: session.userId,
        userType: session.userType
      });
      
      // Return session data
      return {
        userId: session.userId,
        userType: session.userType,
        expires: session.expires,
        user: {
          id: session.userId,
          type: session.userType
        }
      };
    } catch (error) {
      logger.error('Error validating session', { error, sessionId });
      return null;
    }
  }
  
  /**
   * Clears all sessions for a user
   * @param userId - User ID
   * @returns Number of sessions cleared
   */
  async clearUserSessions(userId: string): Promise<number> {
    try {
      logger.debug('Clearing user sessions', { userId });
      
      const result = await this.prisma.session.deleteMany({
        where: { userId }
      });
      
      logger.debug('User sessions cleared', { 
        userId,
        count: result.count
      });
      
      return result.count;
    } catch (error) {
      logger.error('Error clearing user sessions', { error, userId });
      throw error;
    }
  }
  
  /**
   * Refreshes a session by extending its expiration date
   * @param sessionId - Session ID
   * @returns Updated session if successful, null otherwise
   */
  async refreshSession(sessionId: string): Promise<Session | null> {
    try {
      logger.debug('Refreshing session', { sessionId });
      
      // Calculate new expiration date
      const expires = new Date();
      expires.setDate(expires.getDate() + this.sessionDurationDays);
      
      // Update session in database
      const session = await this.prisma.session.update({
        where: { id: sessionId },
        data: {
          expires,
          updatedAt: new Date()
        }
      });
      
      logger.debug('Session refreshed successfully', { 
        sessionId,
        newExpires: expires
      });
      
      return session;
    } catch (error) {
      logger.error('Error refreshing session', { error, sessionId });
      return null;
    }
  }
  
  /**
   * Gets all active sessions for a user
   * @param userId - User ID
   * @returns Array of active sessions
   */
  async getUserActiveSessions(userId: string): Promise<Session[]> {
    try {
      logger.debug('Getting user active sessions', { userId });
      
      const sessions = await this.prisma.session.findMany({
        where: {
          userId,
          expires: { gt: new Date() }
        },
        orderBy: { updatedAt: 'desc' }
      });
      
      logger.debug('User active sessions retrieved', { 
        userId,
        count: sessions.length
      });
      
      return sessions;
    } catch (error) {
      logger.error('Error getting user active sessions', { error, userId });
      throw error;
    }
  }
} 