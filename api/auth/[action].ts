import type { Request, Response } from 'express';
import authHandler from '../auth';

export default async function handler(req: Request, res: Response) {
  return authHandler(req, res);
}
