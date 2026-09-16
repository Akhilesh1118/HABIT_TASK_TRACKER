import type { Request, Response } from 'express';
import { authService } from '../server/services/authService';
import { getAuthCookieOptions } from '../server/middleware/authMiddleware';

export default async function handler(req: Request, res: Response) {
  const action =
    (req.query.action as string) ||
    req.url.split('?')[0].split('/').filter(Boolean).pop() ||
    '';

  if (action === 'login' && req.method === 'POST') {
    const { email, password, rememberMe = true } = req.body || {};
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
    res.cookie('auth_token', result.token, cookieOptions);

    return res.json({
      success: true,
      user: result.user,
      token: result.token,
    });
  }

  if (action === 'logout' && req.method === 'POST') {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('auth_token', {
      path: '/',
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    });
    return res.json({ success: true, message: 'Logged out successfully' });
  }

  if (action === 'me' && req.method === 'GET') {
    const token =
      req.cookies?.auth_token ||
      (req.headers.authorization?.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : null);

    if (!token) {
      return res.json({ authenticated: false, user: null });
    }

    const user = authService.verifyToken(token);
    if (!user) {
      return res.json({ authenticated: false, user: null });
    }

    return res.json({
      authenticated: true,
      user: {
        email: user.email,
        userId: user.userId,
      },
    });
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}
