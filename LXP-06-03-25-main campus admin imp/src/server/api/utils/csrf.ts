/**
 * CSRF Protection Utility
 * Provides functionality to generate and validate CSRF tokens
 */

import { randomBytes, createHmac } from 'crypto';
import { logger } from './logger';

// Constants
const CSRF_SECRET_KEY = process.env.SESSION_SECRET || 'default-csrf-secret-key';
export const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'X-CSRF-Token';
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * CSRF token structure
 */
interface CSRFToken {
  token: string;
  timestamp: number;
}

/**
 * Generates a CSRF token
 * @returns CSRF token
 */
export async function generateCSRFToken(): Promise<string> {
  try {
    // Generate random bytes for token
    const randomString = randomBytes(32).toString('hex');
    
    // Create timestamp for expiry check
    const timestamp = Date.now();
    
    // Create token object
    const tokenObj: CSRFToken = {
      token: randomString,
      timestamp
    };
    
    // Stringify and sign token
    const tokenString = JSON.stringify(tokenObj);
    const signature = createHmac('sha256', CSRF_SECRET_KEY)
      .update(tokenString)
      .digest('hex');
    
    // Combine token and signature
    const csrfToken = `${tokenString}|${signature}`;
    
    // Encode for URL safety
    return Buffer.from(csrfToken).toString('base64');
  } catch (error) {
    logger.error('Error generating CSRF token', { error });
    throw new Error('Failed to generate CSRF token');
  }
}

/**
 * Validates a CSRF token
 * @param token - CSRF token to validate
 * @returns Whether the token is valid
 */
export async function validateCSRFToken(token: string): Promise<boolean> {
  try {
    if (!token) {
      logger.warn('No CSRF token provided');
      return false;
    }
    
    // Decode token
    const decodedToken = Buffer.from(token, 'base64').toString();
    const [tokenString, signature] = decodedToken.split('|');
    
    if (!tokenString || !signature) {
      logger.warn('Invalid CSRF token format');
      return false;
    }
    
    // Verify signature
    const expectedSignature = createHmac('sha256', CSRF_SECRET_KEY)
      .update(tokenString)
      .digest('hex');
    
    if (signature !== expectedSignature) {
      logger.warn('Invalid CSRF token signature');
      return false;
    }
    
    // Parse token data
    const tokenData: CSRFToken = JSON.parse(tokenString);
    
    // Check expiry
    if (Date.now() - tokenData.timestamp > CSRF_TOKEN_EXPIRY) {
      logger.warn('CSRF token expired');
      return false;
    }
    
    return true;
  } catch (error) {
    logger.error('Error validating CSRF token', { error });
    return false;
  }
}

/**
 * Gets the CSRF token from the request
 * @param req - Request object
 * @returns CSRF token if found, undefined otherwise
 */
export function getCSRFTokenFromRequest(req: Request): string | undefined {
  try {
    // Check header first
    const headerToken = req.headers.get(CSRF_HEADER_NAME);
    if (headerToken) return headerToken;
    
    // Check form data if it's a POST request
    if (req.method === 'POST' && req.headers.get('content-type')?.includes('application/json')) {
      // This would require parsing the request body, which is a stream
      // In practice, this would be handled by your API framework
      return undefined;
    }
    
    return undefined;
  } catch (error) {
    logger.error('Error getting CSRF token from request', { error });
    return undefined;
  }
}

/**
 * Sets CSRF protection headers on a response
 * @param res - Response object
 */
export function setCSRFHeaders(res: Response): void {
  try {
    // Set security headers
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-Frame-Options', 'DENY');
    res.headers.set('X-XSS-Protection', '1; mode=block');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    logger.debug('CSRF protection headers set');
  } catch (error) {
    logger.error('Error setting CSRF headers', { error });
  }
} 