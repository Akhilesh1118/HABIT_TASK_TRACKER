import type { Request, Response } from 'express';
import { authService } from '../server/services/authService';
import { getAuthCookieOptions, getCookieFromRequest } from '../server/middleware/authMiddleware';

/**
 * Serializes a cookie name/value pair with standard options into a Set-Cookie header string
 */
function serializeCookie(name: string, val: string, options: any = {}): string {
  const enc = encodeURIComponent;
  let str = `${name}=${enc(val)}`;

  if (options.maxAge != null) {
    const maxAge = Math.floor(options.maxAge / 1000); // convert ms to seconds
    str += `; Max-Age=${maxAge}`;
    const expires = new Date(Date.now() + options.maxAge);
    str += `; Expires=${expires.toUTCString()}`;
  } else if (options.expires) {
    str += `; Expires=${options.expires.toUTCString()}`;
  }

  str += `; Path=${options.path || '/'}`;

  if (options.httpOnly) {
    str += '; HttpOnly';
  }

  if (options.secure) {
    str += '; Secure';
  }

  if (options.sameSite) {
    const sameSite = String(options.sameSite).toLowerCase();
    if (sameSite === 'lax') {
      str += '; SameSite=Lax';
    } else if (sameSite === 'strict') {
      str += '; SameSite=Strict';
    } else if (sameSite === 'none') {
      str += '; SameSite=None';
    }
  }

  return str;
}

/**
 * Universal cookie setter compatible with Express (res.cookie) and Vercel Serverless (res.setHeader)
 */
function setCookieOnResponse(res: any, name: string, value: string, options: any = {}) {
  if (typeof res.cookie === 'function') {
    res.cookie(name, value, options);
    return;
  }
  const serialized = serializeCookie(name, value, options);
  const existing = res.getHeader?.('Set-Cookie') || res.getHeaders?.()['set-cookie'];
  if (!existing) {
    res.setHeader('Set-Cookie', serialized);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, serialized]);
  } else {
    res.setHeader('Set-Cookie', [existing, serialized]);
  }
}

/**
 * Universal cookie clearer compatible with Express (res.clearCookie) and Vercel Serverless (res.setHeader)
 */
function clearCookieOnResponse(res: any, name: string, options: any = {}) {
  if (typeof res.clearCookie === 'function') {
    res.clearCookie(name, options);
    return;
  }
  const isProduction = process.env.NODE_ENV === 'production';
  const clearSerialized = `${name}=; Path=${options.path || '/'}; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Max-Age=0; HttpOnly${isProduction || options.secure ? '; Secure' : ''}${options.sameSite ? `; SameSite=${options.sameSite}` : '; SameSite=Lax'}`;
  const existing = res.getHeader?.('Set-Cookie') || res.getHeaders?.()['set-cookie'];
  if (!existing) {
    res.setHeader('Set-Cookie', clearSerialized);
  } else if (Array.isArray(existing)) {
    res.setHeader('Set-Cookie', [...existing, clearSerialized]);
  } else {
    res.setHeader('Set-Cookie', [existing, clearSerialized]);
  }
}

export default async function handler(req: Request, res: Response) {
  try {
    const action =
      (req.query?.action as string) ||
      req.url.split('?')[0].split('/').filter(Boolean).pop() ||
      '';

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }

    if (action === 'login' && req.method === 'POST') {
      const { email, password, rememberMe = true } = body;
      const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown_ip';

      const result = await authService.login(email, password, clientIp);

      if (!result.success || !result.token) {
        return res.status(401).json({
          success: false,
          error: result.error || 'Authentication failed',
          lockoutRemainingSeconds: result.lockoutRemainingSeconds,
        });
      }

      const cookieOptions = getAuthCookieOptions(Boolean(rememberMe));
      setCookieOnResponse(res, 'auth_token', result.token, cookieOptions);

      return res.status(200).json({
        success: true,
        user: result.user,
        token: result.token,
      });
    }

    if (action === 'logout' && req.method === 'POST') {
      const isProduction = process.env.NODE_ENV === 'production';
      clearCookieOnResponse(res, 'auth_token', {
        path: '/',
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
      });
      return res.status(200).json({ success: true, message: 'Logged out successfully' });
    }

    if (action === 'me' && req.method === 'GET') {
      const token =
        getCookieFromRequest(req, 'auth_token') ||
        (req.cookies?.auth_token as string) ||
        (req.headers.authorization?.startsWith('Bearer ')
          ? req.headers.authorization.slice(7).trim()
          : null);

      if (!token) {
        return res.status(200).json({ authenticated: false, user: null });
      }

      const user = authService.verifyToken(token);
      if (!user) {
        return res.status(200).json({ authenticated: false, user: null });
      }

      return res.status(200).json({
        authenticated: true,
        user: {
          email: user.email,
          userId: user.userId,
        },
      });
    }

    return res.status(404).json({ error: 'Endpoint not found' });
  } catch (err: any) {
    console.error('[Auth API Server Error]', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
}
