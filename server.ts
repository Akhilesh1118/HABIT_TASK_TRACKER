import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { dbService } from './server/services/dbService.ts';
import { aiCoachService } from './server/services/aiCoachService.ts';
import { connectToDatabase } from './server/services/mongoService.ts';
import { authService } from './server/services/authService.ts';
import { authRouter } from './server/routes/authRoutes.ts';
import { taskRouter } from './server/routes/taskRoutes.ts';
import { habitRouter } from './server/routes/habitRoutes.ts';
import { syncRouter } from './server/routes/syncRoutes.ts';
import { requireAuth } from './server/middleware/authMiddleware.ts';
import { getCurrentIST } from './src/utils/timeUtils.ts';
import diagnosticsHandler from './api/diagnostics.ts';

async function startServer() {
  // Connect to MongoDB Atlas (if MONGODB_URI is provided), ensure personal account, and preserve data
  await connectToDatabase();
  await authService.ensurePersonalAccount();
  await dbService.syncWithMongoDB();

  const app = express();
  const PORT = 3000;

  // Security Headers Middleware (Point 7: API security & hardening)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  app.use(express.json());
  app.use(cookieParser());

  // Mount Routers
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api/habits', habitRouter);
  app.use('/api/sync', syncRouter);

  // In-memory sliding window rate limiter for the AI Coach endpoint (max 12 requests per minute per IP)
  const aiCoachRateLimitMap = new Map<string, number[]>();
  function checkAICoachRateLimit(ip: string, maxRequests = 12, windowMs = 60000): boolean {
    const now = Date.now();
    const timestamps = aiCoachRateLimitMap.get(ip) || [];
    const valid = timestamps.filter((t) => now - t < windowMs);
    if (valid.length >= maxRequests) {
      aiCoachRateLimitMap.set(ip, valid);
      return false;
    }
    valid.push(now);
    aiCoachRateLimitMap.set(ip, valid);
    return true;
  }

  // --- API ROUTES ---

  // Health check & current time in IST
  app.get('/api/health', (_req: Request, res: Response) => {
    const ist = getCurrentIST();
    res.json({
      status: 'ok',
      service: 'Habit & Task Tracker API',
      ist,
    });
  });

  // Diagnostic runtime filesystem & import checks
  app.all('/api/diagnostics', (req: Request, res: Response) => {
    diagnosticsHandler(req, res);
  });

  // AI Productivity Coach (Protected)
  app.post('/api/ai-coach', requireAuth, async (req: Request, res: Response) => {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    if (!checkAICoachRateLimit(clientIp)) {
      res.status(429).json({
        success: false,
        error: 'Too Many Requests: Rate limit exceeded. Please wait a moment before generating another analysis.',
      });
      return;
    }

    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch {
          // fallback
        }
      }

      const inputData = body?.inputData;
      if (!inputData || typeof inputData !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Missing or invalid inputData: structured application tracking data is required.',
        });
        return;
      }

      const userId = (req as any).user?.userId;
      const analysis = await aiCoachService.analyzeWeeklyProductivity(inputData, userId);
      res.json({
        success: true,
        analysis,
      });
    } catch (err: any) {
      console.error('[AI Coach Endpoint Error]', err);
      res.status(500).json({
        success: false,
        error: err?.message || 'Failed to generate AI Coach analysis',
      });
    }
  });

  // --- VITE MIDDLEWARE SETUP ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: {
          ignored: [
            '**/.data/**',
            '**/database.json',
            '**/*.tmp*',
            '**/*.tmp.*',
            '**/data/**',
            '**/cron_execution.lock',
          ],
        },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
