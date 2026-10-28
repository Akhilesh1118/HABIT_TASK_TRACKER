import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes } from 'node:crypto';
import { connectToDatabase, isMongoConnected } from './mongoService.ts';
import { UserModel, type UserRole } from '../models/User.ts';
import { UserCategoryModel } from '../models/HabitData.ts';
import { dbService, type DbUserAuth } from './dbService.ts';
import type { CategoryItem } from '../../src/types.ts';

export interface AuthSessionUser {
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
}

export interface AuthResult {
  success: boolean;
  error?: string;
  user?: AuthSessionUser;
  token?: string;
  lockoutRemainingSeconds?: number;
}

export type LoginResult = AuthResult;
export type RegisterResult = AuthResult;

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
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      throw new Error('JWT_SECRET must be configured with at least 16 characters in production.');
    }
    return 'habit_tracker_secure_multi_user_jwt_secret_2026_x89f2a';
  }

  /**
   * Rate limiting / brute-force protection per IP & email identifier
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

    if (record.lockUntil <= now && record.count >= 15) {
      // Lock expired, reset
      this.failedAttempts.delete(identifier);
    }

    return { allowed: true, remainingSeconds: 0 };
  }

  public recordFailedAttempt(identifier: string) {
    const record = this.failedAttempts.get(identifier) || { count: 0, lockUntil: 0 };
    record.count += 1;

    // Allow up to 15 attempts before a short 10-second cooldown
    if (record.count >= 15) {
      record.lockUntil = Date.now() + 10 * 1000;
    }

    this.failedAttempts.set(identifier, record);
  }

  public resetFailedAttempts(identifier: string) {
    this.failedAttempts.delete(identifier);
  }

  /**
   * Initializes the bootstrap admin account if none exists.
   * Reads INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD from environment.
   */
  public async ensurePersonalAccount(): Promise<{ email: string } | null> {
    return this.ensureAdminAccount();
  }

  public async ensureAdminAccount(): Promise<{ email: string } | null> {
    const email = (process.env.INITIAL_ADMIN_EMAIL || 'aky9842@gmail.com').toLowerCase().trim();
    const configuredPassword = process.env.INITIAL_ADMIN_PASSWORD?.trim();
    const getBootstrapPassword = () => {
      if ((process.env.NODE_ENV === 'production' || process.env.VERCEL) &&
        (!configuredPassword || configuredPassword.length < 16)) {
        throw new Error('INITIAL_ADMIN_PASSWORD must be configured with at least 16 characters in production when provisioning the initial administrator.');
      }
      return configuredPassword || 'PersonalPassword2026!';
    };

    try {
      await connectToDatabase();
      if (isMongoConnected()) {
        const existingAdmin = await UserModel.findOne({ email }).lean();
        if (existingAdmin) {
          // Bootstrap credentials are for initial provisioning only. Never reset an
          // existing account's deliberately changed password during ordinary requests.
          const currentHash = (existingAdmin as any).passwordHash;
          if ((existingAdmin as any).role !== 'admin') {
            await UserModel.updateOne({ _id: (existingAdmin as any)._id }, { $set: { role: 'admin' } });
          }

          dbService.saveUserAuth({
            id: (existingAdmin as any)._id.toString(),
            email: (existingAdmin as any).email,
            name: (existingAdmin as any).name || 'Admin',
            passwordHash: currentHash,
            role: 'admin',
            createdAt: ((existingAdmin as any).createdAt || new Date()).toISOString(),
          });
          return { email: (existingAdmin as any).email };
        }

        // If no user exists with this email, bootstrap admin account in MongoDB Atlas
        const passwordHash = await bcrypt.hash(getBootstrapPassword(), 12);
        const newAdmin = await UserModel.create({
          name: 'Admin',
          email,
          passwordHash,
          role: 'admin',
          createdAt: new Date(),
        });

        dbService.saveUserAuth({
          id: newAdmin._id.toString(),
          email: newAdmin.email,
          name: newAdmin.name || 'Admin',
          passwordHash: newAdmin.passwordHash,
          role: 'admin',
          createdAt: newAdmin.createdAt.toISOString(),
        });

        console.log(`[AuthService] Initialized admin account in MongoDB Atlas for: ${email}`);
        return { email: newAdmin.email };
      }
    } catch (e) {
      console.warn('[AuthService] Could not ensure admin in MongoDB:', (e as any)?.message);
    }

    const existingLocal = dbService.findUserByEmail(email);
    if (existingLocal) {
      if (existingLocal.role !== 'admin') {
        existingLocal.role = 'admin';
        dbService.saveUserAuth(existingLocal);
      }
      return { email: existingLocal.email };
    }

    // Fallback: Persist in local dbService
    const fallbackHash = await bcrypt.hash(getBootstrapPassword(), 12);
    dbService.saveUserAuth({
      id: 'usr_admin',
      email,
      name: 'Admin',
      passwordHash: fallbackHash,
      role: 'admin',
      createdAt: new Date().toISOString(),
    });
    console.log(`[AuthService] Initialized admin account in local store for: ${email}`);

    return { email };
  }

  /**
   * Registers a new regular user account (role is ALWAYS 'user')
   */
  public async register(
    emailInput: string,
    passwordInput: string,
    nameInput: string = 'User',
    ip: string = 'unknown'
  ): Promise<RegisterResult> {
    const normalizedEmail = (emailInput || '').toLowerCase().trim();
    const trimmedName = (nameInput || '').trim() || 'User';
    const rateLimitKey = `reg::${ip}`;
    const rateLimit = this.checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      return {
        success: false,
        error: `Too many registration attempts. Please wait ${rateLimit.remainingSeconds} seconds before retrying.`,
        lockoutRemainingSeconds: rateLimit.remainingSeconds,
      };
    }

    if (!normalizedEmail || !passwordInput) {
      return {
        success: false,
        error: 'Email and password are required.',
      };
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return {
        success: false,
        error: 'Please enter a valid email address.',
      };
    }

    if (passwordInput.length < 6) {
      return {
        success: false,
        error: 'Password must be at least 6 characters long.',
      };
    }

    const jwtSecret = this.getJwtSecret();

    // Ensure bootstrap admin is initialized so admin email is reserved
    await this.ensureAdminAccount();

    // Check if user already exists
    try {
      await connectToDatabase();
      if (isMongoConnected()) {
        const existing = await UserModel.findOne({ email: normalizedEmail }).lean();
        if (existing) {
          return {
            success: false,
            error: 'An account with this email address already exists. Please log in.',
          };
        }
      }
    } catch (err: any) {
      console.warn('[AuthService] Error checking user existence in MongoDB:', err?.message);
    }

    const localExisting = dbService.findUserByEmail(normalizedEmail);
    if (localExisting) {
      return {
        success: false,
        error: 'An account with this email address already exists. Please log in.',
      };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(passwordInput, 12);
    let createdUserId = `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    const role: UserRole = 'user'; // Strictly enforce normal user role

    try {
      if (isMongoConnected()) {
        const newUser = await UserModel.create({
          name: trimmedName,
          email: normalizedEmail,
          passwordHash,
          role,
          createdAt: new Date(),
        });
        createdUserId = newUser._id.toString();
      }
    } catch (err: any) {
      console.error('[AuthService] Error saving new user to MongoDB:', err);
      return {
        success: false,
        error: 'Failed to create user account. Please try again.',
      };
    }

    // Save to local fallback store as well
    dbService.saveUserAuth({
      id: createdUserId,
      email: normalizedEmail,
      name: trimmedName,
      passwordHash,
      role,
      createdAt: new Date().toISOString(),
    });

    // Seed full default category suite for new accounts
    const initialCategories: CategoryItem[] = [
      { id: 'cat_ssc_cgl', name: 'SSC CGL', icon: '🎯', color: '#f59e0b', isDefault: true },
      { id: 'cat_technical', name: 'Technical', icon: '💻', color: '#3b82f6', isDefault: true },
      { id: 'cat_english', name: 'English', icon: '🗣️', color: '#8b5cf6', isDefault: true },
      { id: 'cat_health_fitness', name: 'Health/Fitness', icon: '💪', color: '#10b981', isDefault: true },
      { id: 'cat_personal_learning', name: 'Personal Learning', icon: '📖', color: '#7c3aed', isDefault: true },
      { id: 'cat_other', name: 'Other', icon: '📌', color: '#78716c', isDefault: true },
    ];
    dbService.saveCategories(createdUserId, initialCategories);
    if (isMongoConnected()) {
      try {
        await UserCategoryModel.create({
          id: 'cat_personal_learning',
          userId: createdUserId,
          name: 'Personal Learning',
          icon: '📖',
          color: '#7c3aed',
          isDefault: true,
        });
      } catch (catErr: any) {
        console.warn('[AuthService] Error creating initial category for new user:', catErr?.message);
      }
    }

    this.resetFailedAttempts(ip);

    // Issue JWT
    const token = jwt.sign(
      {
        userId: createdUserId,
        email: normalizedEmail,
        name: trimmedName,
        role,
      },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return {
      success: true,
      user: {
        userId: createdUserId,
        email: normalizedEmail,
        name: trimmedName,
        role,
      },
      token,
    };
  }

  /**
   * Authenticates any user credentials (admin or regular user)
   */
  public async login(
    emailInput: string,
    passwordInput: string,
    ip: string
  ): Promise<LoginResult> {
    const normalizedEmail = (emailInput || '').toLowerCase().trim();
    const rateLimitKey = `login::${ip}::${normalizedEmail}`;
    const rateLimit = this.checkRateLimit(rateLimitKey);

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

    const jwtSecret = this.getJwtSecret();

    // Ensure bootstrap admin account exists
    await this.ensureAdminAccount();

    let foundUser: { id: string; email: string; name?: string; passwordHash: string; role: UserRole } | null = null;

    try {
      await connectToDatabase();
      if (isMongoConnected()) {
        const mongoUser = await UserModel.findOne({ email: normalizedEmail }).lean();
        if (mongoUser) {
          foundUser = {
            id: (mongoUser as any)._id.toString(),
            email: (mongoUser as any).email,
            name: (mongoUser as any).name || 'User',
            passwordHash: (mongoUser as any).passwordHash,
            role: ((mongoUser as any).role as UserRole) || 'user',
          };
        }
      }
    } catch (e) {
      console.warn('[AuthService] MongoDB lookup error, checking local store:', (e as any)?.message);
    }

    if (!foundUser) {
      const localUser = dbService.findUserByEmail(normalizedEmail);
      if (localUser && localUser.passwordHash) {
        foundUser = {
          id: localUser.id,
          email: localUser.email,
          name: localUser.name || 'User',
          passwordHash: localUser.passwordHash,
          role: localUser.role || 'user',
        };
      }
    }

    // Dummy hash comparison to prevent timing attacks if user does not exist
    const dummyHash = '$2a$12$e8Y5tGzR9dE1gY9p34wYyeuM72iI5Y5iQ5gPqU4Lw9X3H4z6e2/1e';
    const hashToCompare = foundUser ? foundUser.passwordHash : dummyHash;
    let isPasswordValid = await bcrypt.compare(passwordInput, hashToCompare).catch(() => false);

    if (!foundUser || !isPasswordValid) {
      await new Promise((r) => setTimeout(r, 600));
      this.recordFailedAttempt(rateLimitKey);

      return {
        success: false,
        error: 'Invalid email or password.',
      };
    }

    // Successful login: reset rate limiter
    this.resetFailedAttempts(rateLimitKey);
    this.resetFailedAttempts(ip);

    // Update last login timestamp in MongoDB if connected
    try {
      if (isMongoConnected()) {
        await (UserModel as any).findByIdAndUpdate(foundUser.id, { lastLoginAt: new Date() });
      }
    } catch {
      // Non-blocking
    }

    // Create JWT with userId, email, role, name
    const token = jwt.sign(
      {
        userId: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
      },
      jwtSecret,
      { expiresIn: '30d' }
    );

    return {
      success: true,
      user: {
        userId: foundUser.id,
        email: foundUser.email,
        name: foundUser.name,
        role: foundUser.role,
      },
      token,
    };
  }

  /** Verify a Google ID token and sign in or create the matching account. */
  public async loginWithGoogle(credential: string): Promise<AuthResult> {
    // GOOGLE_CLIENT_ID is the explicit server setting. Accept the Vite client
    // setting as a fallback because it is the same public OAuth Web Client ID.
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || process.env.VITE_GOOGLE_CLIENT_ID?.trim();
    if (!clientId) return { success: false, error: 'Google sign-in is not configured. Please contact the administrator.' };
    if (!credential) return { success: false, error: 'Google sign-in could not be verified.' };

    const verificationResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verificationResponse.ok) return { success: false, error: 'Google sign-in could not be verified. Please try again.' };
    const claims = await verificationResponse.json() as { aud?: string; email?: string; email_verified?: boolean | string; name?: string; exp?: string };
    if (claims.aud !== clientId || !claims.email || !(claims.email_verified === true || claims.email_verified === 'true') ||
      (claims.exp && Number(claims.exp) * 1000 <= Date.now())) {
      return { success: false, error: 'Google sign-in could not be verified. Please try again.' };
    }

    const email = claims.email.toLowerCase().trim();
    let existingUser: { id: string; email: string; name?: string; role?: UserRole } | null = null;
    const mongoConfigured = Boolean(process.env.MONGODB_URI?.trim());
    await connectToDatabase();
    if (mongoConfigured && !isMongoConnected()) {
      return { success: false, error: 'The account database is temporarily unavailable. Please try again shortly.' };
    }
    if (isMongoConnected()) {
      const mongoUser = await UserModel.findOne({ email }).select('_id email name role').lean() as any;
      if (mongoUser) {
        existingUser = {
          id: String(mongoUser._id),
          email: mongoUser.email,
          name: mongoUser.name || claims.name || 'User',
          role: mongoUser.role || 'user',
        };
        await UserModel.updateOne({ _id: mongoUser._id }, { $set: { lastLoginAt: new Date() } });
      }
    }

    if (!existingUser) {
      const localUser = dbService.findUserByEmail(email);
      if (localUser) {
        existingUser = { id: localUser.id, email: localUser.email, name: localUser.name || claims.name || 'User', role: localUser.role || 'user' };
      }
    }

    // A verified Google email can safely link to an existing account with the same email.
    if (!existingUser) {
      const registration = await this.register(email, randomBytes(32).toString('hex'), claims.name || 'User', 'google-oauth');
      return registration;
    }

    const token = jwt.sign({
      userId: existingUser.id,
      email: existingUser.email,
      name: existingUser.name,
      role: existingUser.role || 'user',
    }, this.getJwtSecret(), { expiresIn: '30d' });
    return {
      success: true,
      user: {
        userId: existingUser.id,
        email: existingUser.email,
        name: existingUser.name,
        role: existingUser.role || 'user',
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
      if (decoded && decoded.email && decoded.userId) {
        return {
          userId: decoded.userId,
          email: decoded.email,
          name: decoded.name,
          role: decoded.role || 'user',
        };
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Secure method for user to change their password
   */
  public async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!newPassword || newPassword.length < 6) {
      return { success: false, error: 'New password must be at least 6 characters long.' };
    }

    let user: { id: string; email: string; passwordHash: string } | null = null;

    try {
      await connectToDatabase();
      if (isMongoConnected()) {
        const mongoUser = await UserModel.findById(userId).lean();
        if (mongoUser) {
          user = {
            id: (mongoUser as any)._id.toString(),
            email: (mongoUser as any).email,
            passwordHash: (mongoUser as any).passwordHash,
          };
        }
      }
    } catch {
      // fallback
    }

    if (!user) {
      const local = dbService.findUserById(userId);
      if (local) {
        user = {
          id: local.id,
          email: local.email,
          passwordHash: local.passwordHash,
        };
      }
    }

    if (!user) {
      return { success: false, error: 'User not found.' };
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return { success: false, error: 'Incorrect current password.' };
    }

    const newHash = await bcrypt.hash(newPassword, 12);

    try {
      if (isMongoConnected()) {
        await (UserModel as any).findByIdAndUpdate(user.id, {
          passwordHash: newHash,
          updatedAt: new Date(),
        });
      }
    } catch (err: any) {
      console.warn('[AuthService] Error updating MongoDB password:', err?.message);
    }

    const localUser = dbService.findUserById(user.id);
    if (localUser) {
      dbService.saveUserAuth({
        ...localUser,
        passwordHash: newHash,
      });
    }

    return { success: true };
  }


}

export const authService = new AuthService();
