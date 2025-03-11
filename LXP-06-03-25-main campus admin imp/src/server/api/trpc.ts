/**
 * tRPC Configuration
 * Sets up the base tRPC router with context and middleware
 */

import { initTRPC, TRPCError } from "@trpc/server";
import { type CreateNextContextOptions } from "@trpc/server/adapters/next";
import { ZodError } from "zod";
import { prisma } from "@/server/db";
import { errorHandlingMiddleware } from "./middleware/error-handling.middleware";
import { performanceMiddleware } from "./middleware/performance.middleware";
import { logger } from "./utils/logger";
import { trpcConfig } from "@/utils/trpc-config";
import { createContext } from './context';
import { AcademicCycleService } from "./services/academic-cycle.service";
import { SessionManager } from "./utils/session-manager";
import { isAuthenticated } from "./middleware/authorization";

/**
 * Custom session type to replace NextAuth session
 */
export interface CustomSession {
  userId: string;
  userType: string;
  expires: Date;
  user: {
    id: string;
    type: string;
  };
}

/**
 * Context configuration
 */
interface CreateContextOptions {
  session: CustomSession | null;
  res?: Response;
}

/**
 * Creates the inner context without session validation
 */
export const createInnerTRPCContext = (opts: CreateContextOptions) => {
  return {
    session: opts.session,
    prisma,
    user: opts.session?.user || null,
    res: opts.res
  };
};

/**
 * Gets the user session from cookies or headers
 * This replaces the NextAuth getServerAuthSession function
 */
export const getUserSession = async (req?: Request): Promise<CustomSession | null> => {
  try {
    // Get session ID from request or cookies
    let sessionId: string | undefined;
    
    if (req) {
      // Use the SessionManager to extract session ID from request
      sessionId = SessionManager.getSessionIdFromRequest(req);
      logger.debug('Session ID from request', { 
        sessionId: sessionId ? `${sessionId.substring(0, 8)}...` : null,
        url: req?.url
      });
    } else {
      // Use the SessionManager to get session ID from cookies
      sessionId = await SessionManager.getSessionIdFromCookies();
    }
    
    if (!sessionId) {
      logger.debug('No session ID found');
      return null;
    }

    // Use the SessionManager to validate the session
    const sessionManager = new SessionManager(prisma);
    return await sessionManager.validateSession(sessionId);
  } catch (error) {
    logger.error('Error in getUserSession', { error });
    return null;
  }
};

/**
 * Creates context for incoming API requests
 */
export const createTRPCContext = async (opts: { req?: Request; res?: Response }) => {
  const session = await getUserSession(opts.req);
  return createInnerTRPCContext({ 
    session,
    res: opts.res
  });
};

// Create tRPC API
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: trpcConfig.transformer,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// Export reusable router and procedure helpers
export const createTRPCRouter = t.router;
export const middleware = t.middleware;
export const publicProcedure = t.procedure
  .use(errorHandlingMiddleware)
  .use(performanceMiddleware);

// Protected procedure with error handling and authentication
export const protectedProcedure = t.procedure
  .use(errorHandlingMiddleware)
  .use(performanceMiddleware)
  .use(isAuthenticated);

// Export the context type for use in other files
export type Context = ReturnType<typeof createInnerTRPCContext>; 