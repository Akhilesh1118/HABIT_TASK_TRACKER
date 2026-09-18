import type { Request, Response, NextFunction } from 'express';
import { authService, type AuthSessionUser } from '../services/authService.ts';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: AuthSessionUser;
    }
  }
}

/**
 * Parses cookies from raw Header string if req.cookies is undefined (useful in serverless environments)
 */
export function getCookieFromRequest(req: Request, name: string): string | null {
  if (req.cookies && req.cookies[name]) {
    return req.cookies[name];
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Extracts and verifies auth token from request (cookies or Authorization header)
 */
export function verifyRequestAuth(req: Request): AuthSessionUser | null {
  const cookieToken = getCookieFromRequest(req, 'auth_token');
  const rawAuthHeader = req.headers?.authorization || (req.headers as any)?.Authorization || (req.headers as any)?.['authorization'];
  const bearerToken =
    typeof rawAuthHeader === 'string' && rawAuthHeader.startsWith('Bearer ')
      ? rawAuthHeader.slice(7).trim()
      : null;

  const token = cookieToken || (req.cookies?.auth_token as string) || bearerToken;

  if (!token) return null;
  return authService.verifyToken(token);
}

/**
 * Cookie options helper for consistent, secure HTTP-only cookies
 */
export function getAuthCookieOptions(rememberMe = true) {
  const isProduction = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000, // 30 days or 1 day
    path: '/',
  };
}

/**
 * Middleware: Enforces that the request is made by the authenticated personal user.
 * Supports HTTP-only cookie 'auth_token' or 'Authorization: Bearer <token>' header.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = verifyRequestAuth(req);

  if (!user) {
    if (getCookieFromRequest(req, 'auth_token')) {
      res.clearCookie('auth_token', { path: '/' });
    }
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Personal authentication required. Please log in.',
    });
  }

  req.user = user;
  next();
}

/**
 * Middleware for cron endpoints: Allows authenticated user OR valid CRON_SECRET
 */
export function requireAuthOrCronSecret(req: Request, res: Response, next: NextFunction) {
  const configuredSecret = (process.env.CRON_SECRET || '').trim();
  const authHeader = req.headers.authorization;
  const querySecret = typeof req.query.secret === 'string' ? req.query.secret.trim() : '';

  // 1. Check CRON_SECRET if configured
  if (configuredSecret) {
    const bearerMatch = authHeader && authHeader.startsWith('Bearer ') && authHeader.slice(7).trim() === configuredSecret;
    const queryMatch = querySecret === configuredSecret;
    if (bearerMatch || queryMatch) {
      return next();
    }
  }

  // 2. Otherwise check personal account authentication
  const user = verifyRequestAuth(req);
  if (user) {
    req.user = user;
    return next();
  }

  return res.status(401).json({
    success: false,
    error: 'Unauthorized: Valid CRON_SECRET or authenticated session required.',
  });
}
