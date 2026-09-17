import { Router, Request, Response } from 'express';
import { authService } from '../services/authService';
import { getAuthCookieOptions, requireAuth } from '../middleware/authMiddleware';

export const authRouter = Router();

// POST /api/auth/register - Register a new user
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name = 'User' } = req.body || {};
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() || req.ip || 'unknown_ip';

    const result = await authService.register(email, password, name, clientIp);

    if (!result.success || !result.token) {
      return res.status(400).json({
        success: false,
        error: result.error || 'Registration failed',
        lockoutRemainingSeconds: result.lockoutRemainingSeconds,
      });
    }

    // Set secure HTTP-only cookie
    const cookieOptions = getAuthCookieOptions(true);
    res.cookie('auth_token', result.token, cookieOptions);

    return res.status(201).json({
      success: true,
      user: result.user,
      token: result.token,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during registration. Please try again.',
    });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
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

    // Set secure HTTP-only cookie
    const cookieOptions = getAuthCookieOptions(Boolean(rememberMe));
    res.cookie('auth_token', result.token, cookieOptions);

    return res.json({
      success: true,
      user: result.user,
      token: result.token, // Returned so clients can also pass in Authorization header if needed
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during login. Please try again.',
    });
  }
});

// POST /api/auth/logout
authRouter.post('/logout', (_req: Request, res: Response) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('auth_token', {
    path: '/',
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });

  return res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// GET /api/auth/me
authRouter.get('/me', (req: Request, res: Response) => {
  const token =
    req.cookies?.auth_token ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7).trim()
      : null);

  if (!token) {
    return res.json({
      authenticated: false,
      user: null,
    });
  }

  const user = authService.verifyToken(token);
  if (!user) {
    return res.json({
      authenticated: false,
      user: null,
    });
  }

  return res.json({
    authenticated: true,
    user: {
      email: user.email,
      userId: user.userId,
      name: user.name,
      role: user.role,
    },
  });
});

// POST /api/auth/change-password
authRouter.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required.',
      });
    }

    const result = await authService.changePassword(userId, currentPassword, newPassword);
    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json({
      success: true,
      message: 'Password updated successfully.',
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update password.',
    });
  }
});

