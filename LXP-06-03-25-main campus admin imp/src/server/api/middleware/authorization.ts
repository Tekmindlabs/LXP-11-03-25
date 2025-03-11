/**
 * Authorization Middleware
 * Provides granular permission-based access control for the application
 */

import { TRPCError } from "@trpc/server";
import { type Context } from "../trpc";
import { PermissionService } from "../services/permission.service";
import { UserType, AccessScope, EntityType, SystemStatus } from "@prisma/client";
import { logger } from "../utils/logger";
import type { PermissionCheck } from "../types";
import { ACADEMIC_CYCLE_PERMISSIONS, ROLE_PERMISSIONS } from '../constants/permissions';

// Define types for permissions
type PermissionArray = readonly string[];

interface UserPermission {
  permission: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    status: SystemStatus;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    scope: AccessScope;
    entityType: EntityType | null;
  };
  campusId?: string | null;
}

interface ActiveCampus {
  campusId: string;
}

/**
 * Basic permission check function
 */
export const checkPermission = (userType: UserType, permission: string) => {
  if (userType === 'SYSTEM_ADMIN') {
    return true;
  }
  
  const rolePermissions = (ROLE_PERMISSIONS[userType as keyof typeof ROLE_PERMISSIONS] || []) as PermissionArray;
  return rolePermissions.includes(permission);
};

/**
 * Ensures user is authenticated
 */
export const isAuthenticated = async ({ ctx, next }: { ctx: Context; next: () => Promise<any> }) => {
  try {
    if (!ctx.session) {
      logger.debug('No authenticated session found in context');
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }

    if (!ctx.session.userId) {
      logger.debug('Session found but no userId in session');
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid session - please login again",
      });
    }

    logger.debug('User authenticated successfully', {
      userId: ctx.session.userId,
      userType: ctx.session.userType
    });

    // Set the user in the context
    ctx.user = {
      id: ctx.session.userId,
      type: ctx.session.userType
    };

    return next();
  } catch (error) {
    logger.error('Authentication middleware error', { error });
    throw error;
  }
};

/**
 * Requires a specific permission
 */
export const requirePermission = (permission: string) => {
  return async ({ ctx, next }: { ctx: Context; next: () => Promise<any> }) => {
    try {
      if (!ctx.session?.user) {
        logger.debug('No authenticated user found in context');
        throw new TRPCError({ 
          code: 'UNAUTHORIZED',
          message: 'Please login to access this resource'
        });
      }

      const hasPermissionResult = checkPermission(ctx.session.user.type as UserType, permission);
      if (!hasPermissionResult) {
        logger.debug('User lacks required permission', {
          userId: ctx.session.user.id,
          userType: ctx.session.user.type,
          requiredPermission: permission
        });
        throw new TRPCError({ 
          code: 'FORBIDDEN',
          message: 'You do not have permission to access this resource'
        });
      }

      return next();
    } catch (error) {
      logger.error('Error in permission middleware', { error, permission });
      throw error;
    }
  };
};

/**
 * Validates if a user has a specific permission
 * @param permissionCode - The permission code to check
 * @param campusId - Optional campus ID for campus-specific permissions
 */
export const hasPermission = (permissionCode: string, campusId?: string) => {
  return async ({ ctx, next }: { ctx: Context; next: () => Promise<any> }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userId = ctx.session.userId;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID is required",
      });
    }

    const permissionService = new PermissionService({ prisma: ctx.prisma });
    
    const hasPermissionResult = await permissionService.validatePermission(
      userId,
      permissionCode,
      campusId
    );

    if (!hasPermissionResult) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Insufficient permissions: ${permissionCode}`,
      });
    }

    return next();
  };
};

/**
 * Validates if a user has any of the specified permissions
 * @param permissionCodes - Array of permission codes to check (any match grants access)
 * @param campusId - Optional campus ID for campus-specific permissions
 */
export const hasAnyPermission = (permissionCodes: string[], campusId?: string) => {
  return async ({ ctx, next }: { ctx: Context; next: () => Promise<any> }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userId = ctx.session.userId;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID is required",
      });
    }

    const permissionService = new PermissionService({ prisma: ctx.prisma });
    
    // Check each permission code
    const permissionChecks = await Promise.all(
      permissionCodes.map(code => 
        permissionService.validatePermission(userId, code, campusId)
      )
    );
    
    // If any permission check passes, allow access
    if (!permissionChecks.some(Boolean)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Insufficient permissions. Required one of: ${permissionCodes.join(', ')}`,
      });
    }

    return next();
  };
};

/**
 * Validates if a user has all of the specified permissions
 * @param permissionCodes - Array of permission codes to check (all must match)
 * @param campusId - Optional campus ID for campus-specific permissions
 */
export const hasAllPermissions = (permissionCodes: string[], campusId?: string) => {
  return async ({ ctx, next }: { ctx: Context; next: () => Promise<any> }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userId = ctx.session.userId;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID is required",
      });
    }

    const permissionService = new PermissionService({ prisma: ctx.prisma });
    
    // Check each permission code
    const permissionChecks = await Promise.all(
      permissionCodes.map(code => 
        permissionService.validatePermission(userId, code, campusId)
      )
    );
    
    // All permission checks must pass
    if (!permissionChecks.every(Boolean)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Insufficient permissions. Required all of: ${permissionCodes.join(', ')}`,
      });
    }

    return next();
  };
};

/**
 * Validates if a user has a specific role
 * @param role - The role to check
 */
export const hasRole = (role: UserType) => {
  return async ({ ctx, next }: { ctx: Context; next: () => Promise<any> }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userType = ctx.session.userType;
    if (!userType) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User type is required",
      });
    }

    if (userType !== role && userType !== 'SYSTEM_ADMIN') {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Insufficient role. Required: ${role}`,
      });
    }

    return next();
  };
};

/**
 * Validates if a user belongs to a specific campus
 * @param campusIdField - The field in the input that contains the campus ID
 */
export const belongsToCampus = (campusIdField: string) => {
  return async ({ ctx, next, rawInput }: { ctx: Context; next: () => Promise<any>; rawInput: any }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userId = ctx.session.userId;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID is required",
      });
    }

    // System admins can access any campus
    if (ctx.session.userType === 'SYSTEM_ADMIN') {
      return next();
    }

    const input = rawInput as Record<string, unknown>;
    const campusId = input[campusIdField] as string;

    if (!campusId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Campus ID is required in field: ${campusIdField}`,
      });
    }

    // Check if user belongs to the campus
    const userCampusAccess = await ctx.prisma.userCampusAccess.findFirst({
      where: {
        userId,
        campusId,
        status: 'ACTIVE'
      }
    });

    if (!userCampusAccess) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this campus",
      });
    }

    return next();
  };
};

/**
 * Validates if a user belongs to a specific institution
 * @param institutionIdField - The field in the input that contains the institution ID
 */
export const belongsToInstitution = (institutionIdField: string) => {
  return async ({ ctx, next, rawInput }: { ctx: Context; next: () => Promise<any>; rawInput: any }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userId = ctx.session.userId;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID is required",
      });
    }

    // System admins can access any institution
    if (ctx.session.userType === 'SYSTEM_ADMIN') {
      return next();
    }

    const input = rawInput as Record<string, unknown>;
    const institutionId = input[institutionIdField] as string;

    if (!institutionId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Institution ID is required in field: ${institutionIdField}`,
      });
    }

    // Check if user belongs to the institution
    const user = await ctx.prisma.user.findUnique({
      where: { id: userId },
      select: { institutionId: true }
    });

    if (!user || user.institutionId !== institutionId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this institution",
      });
    }

    return next();
  };
};

/**
 * Validates if a user is the owner of a resource
 * @param resourceIdField - The field in the input that contains the resource ID
 * @param resourceType - The type of resource to check ownership for
 */
export const isResourceOwner = (resourceIdField: string, resourceType: string) => {
  return async ({ ctx, next, rawInput }: { ctx: Context; next: () => Promise<any>; rawInput: any }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Authentication required",
      });
    }

    const userId = ctx.session.userId;
    if (!userId) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "User ID is required",
      });
    }

    // System admins can access any resource
    if (ctx.session.userType === 'SYSTEM_ADMIN') {
      return next();
    }

    const input = rawInput as Record<string, unknown>;
    const resourceId = input[resourceIdField] as string;

    if (!resourceId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Resource ID is required in field: ${resourceIdField}`,
      });
    }

    // Check resource ownership based on resource type
    let isOwner = false;

    // Since we don't have a clear view of all models and their relationships,
    // we'll implement a simplified version that can be expanded later
    switch (resourceType) {
      case 'resource':
        const resource = await ctx.prisma.resource.findUnique({
          where: { id: resourceId },
          select: { ownerId: true }
        });
        isOwner = resource?.ownerId === userId;
        break;
      
      // Add more resource types as needed
      
      default:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Unsupported resource type: ${resourceType}`,
        });
    }

    if (!isOwner) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You are not the owner of this resource",
      });
    }

    return next();
  };
};