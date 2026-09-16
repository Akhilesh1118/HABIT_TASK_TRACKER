import mongoose from 'mongoose';

/**
 * Global cached MongoDB connection for serverless / container environments
 */
let cachedConnection: typeof mongoose | null = null;
let isConnecting = false;

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
    return cachedConnection;
  } catch (error: any) {
    isConnecting = false;
    console.error('[MongoDB] Connection error:', error?.message || error);
    return null;
  }
}

export function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
