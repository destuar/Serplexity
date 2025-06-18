import { Router, Request, Response } from 'express';
import passport from 'passport';
import jwt from 'jsonwebtoken';
import querystring from 'querystring';
import { register, login, logout, refresh, getMe } from '../controllers/authController';
import { authenticate, authorize } from '../middleware/authMiddleware';
import env from '../config/env';
import { User, Role } from '@prisma/client';

const router = Router();

// --- Standard Auth Routes ---
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/logout', authenticate, logout);

// --- User Info ---
router.get('/me', authenticate, getMe);

// --- Test & Verification Routes ---
router.get('/verify', authenticate, (req: Request, res: Response) => {
  res.json({ message: 'Token is valid', user: req.user });
});

router.get('/verify-admin', authenticate, authorize(Role.ADMIN), (req: Request, res: Response) => {
  res.json({ message: 'Admin access verified', user: req.user });
});


// --- OAuth Routes ---
router.get('/google/url', (req: Request, res: Response) => {
    const { GOOGLE_CLIENT_ID, GOOGLE_CALLBACK_URL } = env;
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CALLBACK_URL) {
        return res.status(500).json({ error: 'Google OAuth not configured' });
    }
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(GOOGLE_CALLBACK_URL)}&response_type=code&scope=profile%20email&access_type=offline`;
    res.json({ url: authUrl });
});

router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${env.FRONTEND_URL}/login?error=google-auth-failed`,
    session: false,
  }),
  (req: Request, res: Response) => {
    const user = req.user as User;

    if (!user) {
      return res.redirect(`${env.FRONTEND_URL}/login?error=authentication-failed`);
    }

    const payload = {
      userId: user.id,
      role: user.role,
      tokenVersion: user.tokenVersion,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
    
    const queryParams = {
        token: accessToken,
        userId: user.id,
        email: user.email,
        name: user.name || '',
        role: user.role,
    };

    const redirectUrl = `${env.FRONTEND_URL}/oauth-callback?${querystring.stringify(queryParams)}`;
    res.redirect(redirectUrl);
  }
);

export default router; 