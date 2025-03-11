/**
 * Session Cleanup Utility
 * Provides functionality to clean up expired and inactive sessions
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Session cleanup options
 */
export interface SessionCleanupOptions {
  /**
   * Number of days after which inactive sessions should be cleaned up
   * Default: 30 days
   */
  inactiveSessionThresholdDays?: number;
}

/**
 * Session cleanup result
 */
export interface SessionCleanupResult {
  /**
   * Number of expired sessions deleted
   */
  expiredSessionsDeleted: number;
  
  /**
   * Number of inactive sessions deleted
   */
  inactiveSessionsDeleted: number;
  
  /**
   * Number of duplicate sessions deleted
   */
  duplicateSessionsDeleted: number;
  
  /**
   * Total number of sessions deleted
   */
  totalSessionsDeleted: number;
}

/**
 * Session Cleanup class
 * Handles cleaning up expired and inactive sessions
 */
export class SessionCleanup {
  private prisma: PrismaClient;
  private options: Required<SessionCleanupOptions>;
  
  /**
   * Creates a new SessionCleanup instance
   * @param prisma - Prisma client instance
   * @param options - Session cleanup options
   */
  constructor(
    prisma: PrismaClient,
    options: SessionCleanupOptions = {}
  ) {
    this.prisma = prisma;
    this.options = {
      inactiveSessionThresholdDays: options.inactiveSessionThresholdDays ?? 30,
    };
  }
  
  /**
   * Cleans up expired sessions
   * @returns Number of expired sessions deleted
   */
  async cleanupExpiredSessions(): Promise<number> {
    try {
      logger.debug('Cleaning up expired sessions');
      
      const now = new Date();
      
      const { count } = await this.prisma.session.deleteMany({
        where: {
          expires: {
            lt: now
          }
        }
      });
      
      logger.info(`Deleted ${count} expired sessions`);
      return count;
    } catch (error) {
      logger.error('Error cleaning up expired sessions', { error });
      throw error;
    }
  }
  
  /**
   * Cleans up inactive sessions
   * @returns Number of inactive sessions deleted
   */
  async cleanupInactiveSessions(): Promise<number> {
    try {
      const { inactiveSessionThresholdDays } = this.options;
      logger.debug(`Cleaning up inactive sessions older than ${inactiveSessionThresholdDays} days`);
      
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - inactiveSessionThresholdDays);
      
      const { count } = await this.prisma.session.deleteMany({
        where: {
          updatedAt: {
            lt: thresholdDate
          },
          // Don't delete sessions that haven't expired yet
          expires: {
            gt: new Date()
          }
        }
      });
      
      logger.info(`Deleted ${count} inactive sessions older than ${inactiveSessionThresholdDays} days`);
      return count;
    } catch (error) {
      logger.error('Error cleaning up inactive sessions', { error });
      throw error;
    }
  }
  
  /**
   * Cleans up duplicate sessions for the same user
   * Keeps only the most recent session for each user
   * @returns Number of duplicate sessions deleted
   */
  async cleanupDuplicateSessions(): Promise<number> {
    try {
      logger.debug('Cleaning up duplicate sessions');
      
      // Find users with multiple active sessions
      const usersWithMultipleSessions = await this.prisma.$queryRaw<
        Array<{ userId: string; sessionCount: number }>
      >`
        SELECT "userId", COUNT(*) as "sessionCount"
        FROM "Session"
        WHERE "expires" > NOW()
        GROUP BY "userId"
        HAVING COUNT(*) > 1
      `;
      
      let totalDeleted = 0;
      
      // For each user with multiple sessions, keep only the most recent one
      for (const { userId, sessionCount } of usersWithMultipleSessions) {
        // Get all sessions for this user, ordered by updatedAt descending
        const userSessions = await this.prisma.session.findMany({
          where: {
            userId,
            expires: {
              gt: new Date()
            }
          },
          orderBy: {
            updatedAt: 'desc'
          }
        });
        
        // Keep the most recent session, delete the rest
        const sessionsToDelete = userSessions.slice(1);
        const sessionIdsToDelete = sessionsToDelete.map(s => s.id);
        
        if (sessionIdsToDelete.length > 0) {
          const { count } = await this.prisma.session.deleteMany({
            where: {
              id: {
                in: sessionIdsToDelete
              }
            }
          });
          
          totalDeleted += count;
          logger.debug(`Deleted ${count} duplicate sessions for user ${userId}`);
        }
      }
      
      logger.info(`Deleted ${totalDeleted} duplicate sessions in total`);
      return totalDeleted;
    } catch (error) {
      logger.error('Error cleaning up duplicate sessions', { error });
      throw error;
    }
  }
  
  /**
   * Runs all cleanup operations
   * @returns Session cleanup result
   */
  async cleanupAll(): Promise<SessionCleanupResult> {
    try {
      logger.info('Starting session cleanup');
      
      const expiredSessionsDeleted = await this.cleanupExpiredSessions();
      const inactiveSessionsDeleted = await this.cleanupInactiveSessions();
      const duplicateSessionsDeleted = await this.cleanupDuplicateSessions();
      
      const totalSessionsDeleted = 
        expiredSessionsDeleted + 
        inactiveSessionsDeleted + 
        duplicateSessionsDeleted;
      
      logger.info('Session cleanup completed', {
        expiredSessionsDeleted,
        inactiveSessionsDeleted,
        duplicateSessionsDeleted,
        totalSessionsDeleted
      });
      
      return {
        expiredSessionsDeleted,
        inactiveSessionsDeleted,
        duplicateSessionsDeleted,
        totalSessionsDeleted
      };
    } catch (error) {
      logger.error('Error in session cleanup', { error });
      throw error;
    }
  }
}