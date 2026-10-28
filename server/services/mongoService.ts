import mongoose from 'mongoose';

// CRITICAL: fail fast, don't hang if MongoDB is offline or disconnected
mongoose.set('bufferCommands', false);

/**
 * Global cached MongoDB connection for serverless / container environments
 */
let cachedConnection: typeof mongoose | null = null;
let isConnecting = false;

// Attach error handlers to prevent unhandled 'error' events from crashing the process
mongoose.connection.on('error', (err) => {
  console.warn('[MongoDB] Connection event warning:', err?.message || err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('[MongoDB] Disconnected from MongoDB Atlas');
});

export async function connectToDatabase(): Promise<typeof mongoose | null> {
  const uri = process.env.MONGODB_URI;

  if (!uri || !uri.trim()) {
    // If MONGODB_URI is not provided, return null to allow graceful fallback
    return null;
  }

  if (cachedConnection && mongoose.connection.readyState === 1) {
    return cachedConnection;
  }

  if (isConnecting) {
    // Wait briefly if connection is in-flight
    await new Promise((resolve) => setTimeout(resolve, 300));
    if (cachedConnection && mongoose.connection.readyState === 1) {
      return cachedConnection;
    }
  }

  try {
    isConnecting = true;
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cachedConnection = await mongoose.connect(uri.trim(), opts);
    isConnecting = false;
    console.log('[MongoDB] Connected successfully to MongoDB Atlas');

    // Drop legacy global unique index id_1 on collections if present, allowing multi-user compound indexes
    await sanitizeMongoIndexes();

    return cachedConnection;
  } catch (error: any) {
    isConnecting = false;
    console.error('[MongoDB] Connection error:', error?.message || error);
    return null;
  }
}

export async function sanitizeMongoIndexes(): Promise<void> {
  if (!mongoose.connection || mongoose.connection.readyState !== 1) return;
  const collectionsToClean = ['focussessions', 'tasks', 'habits'];
  for (const colName of collectionsToClean) {
    try {
      const col = mongoose.connection.collection(colName);
      const indexes = await col.indexes();
      const legacyUniqueId = indexes.find((idx) => idx.name === 'id_1' && idx.unique);
      if (legacyUniqueId) {
        await col.dropIndex('id_1');
        console.log(`[MongoDB] Successfully dropped legacy unique index id_1 on ${colName}`);
      }
    } catch {
      // Ignore if collection doesn't exist yet or index already dropped
    }
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
