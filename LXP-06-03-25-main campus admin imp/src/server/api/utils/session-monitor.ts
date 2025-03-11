/**
 * Session Monitoring Utility
 * Provides functionality to monitor session health and metrics
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

/**
 * Session metrics interface
 */
export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  sessionsPerUser: number;
  oldestSessionAge: number; // in days
  averageSessionAge: number; // in days
  timestamp: Date;
}

export class SessionMonitor {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get comprehensive session metrics
   * @returns Session metrics
   */
  async getSessionMetrics(): Promise<SessionMetrics> {
    try {
      const now = new Date();
      
      // Get total sessions count
      const totalSessions = await this.prisma.session.count();
      
      // Get active sessions (not expired)
      const activeSessions = await this.prisma.session.count({
        where: {
          expires: {
            gt: now,
          },
        },
      });
      
      // Get expired sessions
      const expiredSessions = await this.prisma.session.count({
        where: {
          expires: {
            lt: now,
          },
        },
      });
      
      // Get user count with sessions
      const usersWithSessions = await this.prisma.user.count({
        where: {
          sessions: {
            some: {},
          },
        },
      });
      
      // Calculate sessions per user
      const sessionsPerUser = usersWithSessions > 0 
        ? totalSessions / usersWithSessions 
        : 0;
      
      // Get oldest session
      const oldestSession = await this.prisma.session.findFirst({
        orderBy: {
          createdAt: 'asc',
        },
      });
      
      // Calculate oldest session age in days
      const oldestSessionAge = oldestSession
        ? Math.floor((now.getTime() - oldestSession.createdAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      
      // Get all sessions to calculate average age
      const allSessions = await this.prisma.session.findMany({
        select: {
          createdAt: true,
        },
      });
      
      // Calculate average session age in days
      const totalAgeInDays = allSessions.reduce((sum, session) => {
        const ageInDays = (now.getTime() - session.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        return sum + ageInDays;
      }, 0);
      
      const averageSessionAge = allSessions.length > 0
        ? totalAgeInDays / allSessions.length
        : 0;
      
      return {
        totalSessions,
        activeSessions,
        expiredSessions,
        sessionsPerUser,
        oldestSessionAge,
        averageSessionAge,
        timestamp: now,
      };
    } catch (error) {
      logger.error('Error getting session metrics', { error });
      throw error;
    }
  }

  /**
   * Get session count by user type
   * @returns Map of user types to session counts
   */
  async getSessionsByUserType(): Promise<Record<string, number>> {
    try {
      const result: Record<string, number> = {};
      
      // Get all sessions with user information
      const sessions = await this.prisma.session.findMany({
        where: {
          expires: {
            gt: new Date(),
          },
        },
        include: {
          user: {
            select: {
              userType: true,
            },
          },
        },
      });
      
      // Count sessions by user type
      sessions.forEach(session => {
        const userType = session.user.userType;
        result[userType] = (result[userType] || 0) + 1;
      });
      
      return result;
    } catch (error) {
      logger.error('Error getting sessions by user type', { error });
      throw error;
    }
  }

  /**
   * Get users with multiple active sessions
   * @returns List of users with multiple sessions
   */
  async getUsersWithMultipleSessions(): Promise<Array<{ userId: string; sessionCount: number }>> {
    try {
      // Get all users with their session counts
      const usersWithSessionCounts = await this.prisma.user.findMany({
        where: {
          sessions: {
            some: {
              expires: {
                gt: new Date(),
              },
            },
          },
        },
        select: {
          id: true,
          _count: {
            select: {
              sessions: true,
            },
          },
        },
      });
      
      // Filter users with multiple sessions
      return usersWithSessionCounts
        .filter(user => user._count.sessions > 1)
        .map(user => ({
          userId: user.id,
          sessionCount: user._count.sessions,
        }))
        .sort((a, b) => b.sessionCount - a.sessionCount); // Sort by session count descending
    } catch (error) {
      logger.error('Error getting users with multiple sessions', { error });
      throw error;
    }
  }
} 