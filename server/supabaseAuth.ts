import { createClient } from '@supabase/supabase-js';
import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true, // Automatically create sessions table if it doesn't exist
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

async function upsertUser(supabaseUserId: string, email: string, metadata?: any) {
  await storage.upsertUser({
    id: supabaseUserId,
    email: email,
    firstName: metadata?.firstName || metadata?.first_name || email.split('@')[0],
    lastName: metadata?.lastName || metadata?.last_name || '',
    profileImageUrl: metadata?.avatar_url || null,
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  const sessionMiddleware = getSession();
  app.use(sessionMiddleware);

  // Signup endpoint
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Create user in Supabase
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm for now
        user_metadata: { firstName, lastName }
      });

      if (error) {
        console.error('Supabase signup error:', error);
        return res.status(400).json({ error: error.message });
      }

      // Store user in our database
      await upsertUser(data.user.id, email, { firstName, lastName });

      // Create session
      req.session.userId = data.user.id;
      req.session.email = email;

      res.json({ 
        user: { 
          id: data.user.id, 
          email: email,
          firstName,
          lastName
        } 
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      res.status(500).json({ error: error.message || 'Signup failed' });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }

      // Sign in with Supabase
      const { data, error } = await supabaseAdmin.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Supabase login error:', error);
        return res.status(401).json({ error: "Invalid email or password" });
      }

      // Get user metadata
      const { data: { user } } = await supabaseAdmin.auth.getUser(data.session.access_token);
      
      if (!user) {
        return res.status(401).json({ error: "User not found" });
      }

      // Upsert user in our database
      await upsertUser(user.id, user.email!, user.user_metadata);

      // Create session
      req.session.userId = user.id;
      req.session.email = user.email;

      res.json({ 
        user: { 
          id: user.id, 
          email: user.email,
          firstName: user.user_metadata?.firstName || user.user_metadata?.first_name,
          lastName: user.user_metadata?.lastName || user.user_metadata?.last_name
        } 
      });
    } catch (error: any) {
      console.error('Login error:', error);
      res.status(500).json({ error: error.message || 'Login failed' });
    }
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ success: true });
    });
  });

  // Get current user
  app.get("/api/user", async (req, res) => {
    if (!req.session.userId) {
      return res.json({ user: null });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      res.json({ user });
    } catch (error) {
      console.error('Get user error:', error);
      res.json({ user: null });
    }
  });

  // Password reset request
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: "Email is required" });
      }

      const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo: `${req.protocol}://${req.get('host')}/reset-password`,
      });

      if (error) {
        console.error('Password reset error:', error);
        return res.status(400).json({ error: error.message });
      }

      res.json({ message: "Password reset email sent" });
    } catch (error: any) {
      console.error('Password reset error:', error);
      res.status(500).json({ error: error.message || 'Password reset failed' });
    }
  });

  // Update password
  app.post("/api/auth/update-password", async (req, res) => {
    try {
      const { password, accessToken } = req.body;

      if (!password || !accessToken) {
        return res.status(400).json({ error: "Password and access token are required" });
      }

      const { error } = await supabaseAdmin.auth.updateUser({
        password
      });

      if (error) {
        console.error('Update password error:', error);
        return res.status(400).json({ error: error.message });
      }

      res.json({ message: "Password updated successfully" });
    } catch (error: any) {
      console.error('Update password error:', error);
      res.status(500).json({ error: error.message || 'Password update failed' });
    }
  });

  return sessionMiddleware;
}

// Middleware to check if user is authenticated
export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Fetch user from database and populate req.user
    const user = await storage.getUser(req.session.userId);
    
    if (!user) {
      // User session exists but user not found in database
      req.session.destroy(() => {});
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Populate req.user to match the expected structure from Replit Auth
    req.user = {
      id: user.id,
      email: user.email,
      claims: {
        sub: user.id,
        email: user.email,
        first_name: user.firstName,
        last_name: user.lastName,
      }
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Type augmentation for session
declare module 'express-session' {
  interface SessionData {
    userId: string;
    email: string;
  }
}
