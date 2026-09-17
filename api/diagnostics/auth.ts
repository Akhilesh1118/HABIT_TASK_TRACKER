import type { Request, Response } from 'express';
import { authService } from '../../server/services/authService.ts';
import { UserModel } from '../../server/models/User.ts';

export default async function handler(req: Request, res: Response) {
  const isVercel = Boolean(process.env.VERCEL);
  const authServiceLoaded = Boolean(authService && typeof authService.login === 'function');
  const userModelLoaded = Boolean(UserModel && typeof UserModel.findOne === 'function');
  const jwtSecretConfigured = Boolean(process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length > 0);

  const supportedAuthOperations = [
    'POST /api/auth/register',
    'POST /api/auth/login',
    'POST /api/auth/logout',
    'GET /api/auth/me',
    'POST /api/auth/change-password',
  ];

  return res.status(200).json({
    status: 'ok',
    isVercel,
    authServiceLoaded,
    userModelLoaded,
    jwtSecretConfigured,
    authRouteAvailable: true,
    supportedAuthOperations,
  });
}
