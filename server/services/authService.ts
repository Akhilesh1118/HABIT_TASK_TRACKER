import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { connectToDatabase, isMongoConnected } from './mongoService';
import { UserModel } from '../models/User';
import { dbService } from './dbService';

export interface AuthSessionUser {
  userId: string;
  email: string;
}

export interface LoginResult {
  success: boolean;
  error?: string;
  user?: AuthSessionUser;
  token?: string;
  lockoutRemainingSeconds?: number;
}

class AuthService {
  private failedAttempts = new Map<string, { count: number; lockUntil: number }>();

  /**
   * Resolve a secure JWT secret
   */
  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (secret && secret.trim().length >= 16) {
      return secret.trim();
    }
    // Fallback deterministic fallback if not yet provided in .env
    return 'habit_tracker_secure_single_user_jwt_secret_2026_x89f2a';
  }

  /**
   * Rate limiting / brute-force protection
   */
  public checkRateLimit(identifier: string): { allowed: boolean; remainingSeconds: number } {
    const record = this.failedAttempts.get(identifier);
    const now = Date.now();

    if (!record) {
      return { allowed: true, remainingSeconds: 0 };
    }

    if (record.lockUntil > now) {
      const remainingSeconds = Math.ceil((record.lockUntil - now) / 1000);
      return { allowed: false, remainingSeconds };
    }

    if (record.lockUntil <= now && record.count >= 5) {
      // Lock expired, reset
      this.failedAttempts.delete(identifier);
    }

    return { allowed: true, remainingSeconds: 0 };
  }

  public recordFailedAttempt(identifier: string) {
    const record = this.failedAttempts.get(identifier) || { count: 0, lockUntil: 0 };
    record.count += 1;

    if (record.count >= 5) {
      // Lock out for 5 minutes after 5 failed attempts
      record.lockUntil = Date.now() + 5 * 60 * 1000;
    }

    this.failedAttempts.set(identifier, record);
  }

  public resetFailedAttempts(identifier: string) {
    this.failedAttempts.delete(identifier);
  }

  /**
   * Compare secrets without leaking where the first differing character occurs.
   */
  private secretsMatch(left: string, right: string): boolean {
    const leftDigest = crypto.createHash('sha256').update(left).digest();
    const rightDigest = crypto.createHash('sha256').update(right).digest();
    return crypto.timingSafeEqual(leftDigest, rightDigest);
  }

  /**
   * Get single personal account credentials.
   * Priority: MongoDB Atlas User collection -> Local database.json -> Initial env setup
   */
  public async getSingleUser(): Promise<{ id: string; email: string; passwordHash: string } | null> {
    try {
      await connectToDatabase();
      if (isMongoConnected()) {
        const mongoUser = await UserModel.findOne().sort({ createdAt: 1 }).lean();
        if (mongoUser) {
          return {
            id: (mongoUser as any)._id.toString(),
            email: (mongoUser as any).email,
            passwordHash: (mongoUser as any).passwordHash,
          };
        }
      }
    } catch (e) {
      console.warn('[AuthService] MongoDB lookup error, checking local store:', (e as any)?.message);
    }

    // Fallback: Check local dbService (for local development or pre-MongoDB initialization)
    const localUser = dbService.getSingleUserAuth();
    if (localUser && localUser.passwordHash) {
      return {
        id: localUser.id || 'usr_personal',
        email: localUser.email,
        passwordHash: localUser.passwordHash,
      };
    }

    return null;
  }

  /**
   * Initializes the single personal user account if none exists.
   * Reads INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD from environment,
   * or allows first-time personal account provisioning.
   */
  public async ensurePersonalAccount(): Promise<{ email: string } | null> {
    const email = (process.env.INITIAL_ADMIN_EMAIL || 'aky9842@gmail.com').toLowerCase().trim();
    const rawPassword = process.env.INITIAL_ADMIN_PASSWORD || 'PersonalPassword2026!';

    try {
      await connectToDatabase();
      if (isMongoConnected()) {
        const mongoUser = await UserModel.findOne({ email }).lean();
        if (mongoUser) {
          dbService.setSingleUserAuth({
            id: (mongoUser as any)._id.toString(),
            email: (mongoUser as any).email,
            passwordHash: (mongoUser as any).passwordHash,
            createdAt: ((mongoUser as any).createdAt || new Date()).toISOString(),
          });
          return { email: (mongoUser as any).email };
        }

        // If no user exists with this email, create it in MongoDB Atlas
        const passwordHash = await bcrypt.hash(rawPassword, 12);
        const newUser = await UserModel.create({
          email,
          passwordHash,
          createdAt: new Date(),
        });

        dbService.setSingleUserAuth({
          id: newUser._id.toString(),
          email: newUser.email,
          passwordHash: newUser.passwordHash,
          createdAt: newUser.createdAt.toISOString(),
        });

        console.log(`[AuthService] Initialized personal account in MongoDB Atlas for: ${email}`);
        return { email: newUser.email };
      }
    } catch (e) {
      console.warn('[AuthService] Could not ensure user in MongoDB:', (e as any)?.message);
    }

    const existingLocal = dbService.getSingleUserAuth();
    if (existingLocal && existingLocal.email === email) {
      return { email: existingLocal.email };
    }

    // Fallback: Persist in local dbService
    const fallbackHash = await bcrypt.hash(rawPassword, 12);
    dbService.setSingleUserAuth({
      id: 'usr_personal',
      email,
      passwordHash: fallbackHash,
      createdAt: new Date().toISOString(),
    });
    console.log(`[AuthService] Initialized personal account in local store for: ${email}`);

    return { email };
  }

  /**
   * Authenticates personal login credentials
   */
  public async login(
    emailInput: string,
    passwordInput: string,
    ip: string
  ): Promise<LoginResult> {
    const normalizedEmail = (emailInput || '').toLowerCase().trim();
    const rateLimit = this.checkRateLimit(ip);

    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Too many failed login attempts. Please wait ${rateLimit.remainingSeconds} seconds before retrying.`,
        lockoutRemainingSeconds: rateLimit.remainingSeconds,
      };
    }

    if (!normalizedEmail || !passwordInput) {
      return {
        success: false,
        error: 'Email and password are required.',
      };
    }

    // Ensure initial personal account exists if not already set up
    await this.ensurePersonalAccount();

    const user = await this.getSingleUser();
    if (!user) {
      return {
        success: false,
        error: 'No personal account has been initialized yet.',
      };
    }

    const configuredEmail = process.env.INITIAL_ADMIN_EMAIL?.toLowerCase().trim();
    const configuredPassword = process.env.INITIAL_ADMIN_PASSWORD;
    const hasConfiguredCredentials = Boolean(configuredEmail && configuredPassword);

    // Deployment credentials are authoritative when both values are configured.
    // This lets an administrator rotate credentials without being locked out by
    // a password hash persisted during an earlier deployment.
    const expectedEmail = hasConfiguredCredentials ? configuredEmail! : user.email.toLowerCase();
    const isEmailMatch = expectedEmail === normalizedEmail;
    const isPasswordValid = hasConfiguredCredentials
      ? this.secretsMatch(passwordInput, configuredPassword!)
      : await bcrypt.compare(
          passwordInput,
          isEmailMatch
            ? user.passwordHash
            : '$2a$12$e8Y5tGzR9dE1gY9p34wYyeuM72iI5Y5iQ5gPqU4Lw9X3H4z6e2/1e'
        );

    if (!isEmailMatch || !isPasswordValid) {
      // Artificial delay to prevent rapid brute-forcing
      await new Promise((r) => setTimeout(r, 600));
      this.recordFailedAttempt(ip);

      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    // Successful login: reset rate limiter
    this.resetFailedAttempts(ip);

    // Update last login timestamp in MongoDB if connected
    try {
      if (isMongoConnected()) {
        await (UserModel as any).findByIdAndUpdate(user.id, { lastLoginAt: new Date() });
      }
    } catch {
      // Non-blocking
    }

    // Create JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: expectedEmail,
      },
      this.getJwtSecret(),
      { expiresIn: '30d' }
    );

    return {
      success: true,
      user: {
        userId: user.id,
        email: expectedEmail,
      },
      token,
    };
  }

  /**
   * Verifies an active JWT session token
   */
  public verifyToken(token: string): AuthSessionUser | null {
    try {
      const decoded = jwt.verify(token, this.getJwtSecret()) as any;
      if (decoded && decoded.email) {
        return {
          userId: decoded.userId || 'usr_personal',
          email: decoded.email,
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Secure method for personal user to change their password
   */
  public async changePassword(
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 8) {
      return { success: false, error: 'New password must be at least 8 characters long.' };
    }

    const user = await this.getSingleUser();
    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return { success: false, error: 'Incorrect current password.' };
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    try {
      await connectToDatabase();
      if (isMongoConnected()) {
        await (UserModel as any).findByIdAndUpdate(user.id, {
          passwordHash: newHash,
          updatedAt: new Date(),
        });
      }
    } catch (err: any) {
      console.warn('[AuthService] Error updating MongoDB password:', err?.message);
    }

    // Update local store as well
    dbService.setSingleUserAuth({
      id: user.id,
      email: user.email,
      passwordHash: newHash,
      createdAt: new Date().toISOString(),
    });

    return { success: true };
  }
}

export const authService = new AuthService();
