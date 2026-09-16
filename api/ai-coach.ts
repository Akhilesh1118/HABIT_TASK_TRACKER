import type { Request, Response } from 'express';
import { aiCoachService } from '../server/services/aiCoachService';
import { verifyRequestAuth } from '../server/middleware/authMiddleware';

// In-memory sliding window rate limiter for the AI Coach endpoint (max 12 requests per minute per IP)
const rateLimitMap = new Map<string, number[]>();

function checkRateLimit(ip: string, maxRequests = 12, windowMs = 60000): boolean {
  const now = Date.now();
  const timestamps = rateLimitMap.get(ip) || [];
  const validTimestamps = timestamps.filter((t) => now - t < windowMs);

  if (validTimestamps.length >= maxRequests) {
    rateLimitMap.set(ip, validTimestamps);
    return false; // Rate limit exceeded
  }

  validTimestamps.push(now);
  rateLimitMap.set(ip, validTimestamps);
  return true;
}

export default async function handler(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method Not Allowed: Use POST to generate AI coach analysis.',
    });
  }

  const user = verifyRequestAuth(req);
  if (!user) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Personal authentication required.',
    });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Too Many Requests: Rate limit exceeded. Please wait a moment before generating another analysis.',
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // use raw body
      }
    }

    const inputData = body?.inputData;
    if (!inputData || typeof inputData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid inputData: Structured application tracking data is required.',
      });
    }

    const analysis = await aiCoachService.analyzeWeeklyProductivity(inputData);
    return res.status(200).json({
      success: true,
      analysis,
    });
  } catch (err: any) {
    console.error('[Vercel AI Coach Serverless Error]', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Failed to generate AI Coach analysis',
    });
  }
}
