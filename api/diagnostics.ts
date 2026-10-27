import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  sizeBytes?: number;
  children?: FileNode[];
}

function listDirectoryRecursive(dirPath: string, maxDepth = 3, currentDepth = 0): FileNode[] {
  if (currentDepth > maxDepth || !fs.existsSync(dirPath)) {
    return [];
  }

  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Ignore noisy or huge directories
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === '.next' ||
        entry.name === '.turbo' ||
        entry.name === '.cache'
      ) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(process.cwd(), fullPath) || entry.name;

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: 'directory',
          children: listDirectoryRecursive(fullPath, maxDepth, currentDepth + 1),
        });
      } else if (entry.isFile()) {
        try {
          const stats = fs.statSync(fullPath);
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
            sizeBytes: stats.size,
          });
        } catch {
          nodes.push({
            name: entry.name,
            path: relativePath,
            type: 'file',
          });
        }
      }
    }

    return nodes;
  } catch (err: any) {
    return [
      {
        name: `[Error reading directory: ${err?.message}]`,
        path: dirPath,
        type: 'file',
      },
    ];
  }
}

export default async function handler(req: Request, res: Response) {
  const cwd = process.cwd();

  // List of critical imports expected across Vercel serverless functions
  const criticalImportPaths = [
    'server/services/mongoService.ts',
    'server/services/authService.ts',
    'server/services/dbService.ts',
    'server/services/aiCoachService.ts',
    'server/models/HabitData.ts',
    'server/models/User.ts',
    'server/middleware/authMiddleware.ts',
    'src/types.ts',
    'src/utils/timeUtils.ts',
    'api/auth.ts',
    'api/sync.ts',
    'api/health.ts',
    'api/ai-coach.ts',
  ];

  const fileChecks: Record<string, { exists: boolean; fullPath: string; sizeBytes?: number }> = {};
  for (const relPath of criticalImportPaths) {
    const fullPath = path.resolve(cwd, relPath);
    const exists = fs.existsSync(fullPath);
    let sizeBytes: number | undefined;
    if (exists) {
      try {
        sizeBytes = fs.statSync(fullPath).size;
      } catch {
        // ignore
      }
    }
    fileChecks[relPath] = {
      exists,
      fullPath,
      sizeBytes,
    };
  }

  // Test dynamic import viability at runtime
  const importTests: Record<string, { status: 'ok' | 'error'; message?: string }> = {};

  try {
    const timeUtils = await import('../src/utils/timeUtils.ts');
    importTests['../src/utils/timeUtils.ts'] = {
      status: typeof timeUtils.getCurrentIST === 'function' ? 'ok' : 'error',
    };
  } catch (e: any) {
    importTests['../src/utils/timeUtils.ts'] = { status: 'error', message: e?.message };
  }

  try {
    const dbServiceMod = await import('../server/services/dbService.ts');
    importTests['../server/services/dbService.ts'] = {
      status: dbServiceMod.dbService ? 'ok' : 'error',
    };
  } catch (e: any) {
    importTests['../server/services/dbService.ts'] = { status: 'error', message: e?.message };
  }

  try {
    const mongoMod = await import('../server/services/mongoService.ts');
    importTests['../server/services/mongoService.ts'] = {
      status: typeof mongoMod.connectToDatabase === 'function' ? 'ok' : 'error',
    };
  } catch (e: any) {
    importTests['../server/services/mongoService.ts'] = { status: 'error', message: e?.message };
  }

  const fileTree = listDirectoryRecursive(cwd, 3);

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: {
      isVercel: Boolean(process.env.VERCEL),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cwd,
    },
    criticalImportChecks: fileChecks,
    runtimeImportTests: importTests,
    filesystemTree: fileTree,
  });
}
