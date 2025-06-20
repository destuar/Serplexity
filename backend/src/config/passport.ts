import passport from 'passport';
import { Strategy as GoogleStrategy, Profile } from 'passport-google-oauth20';
import prisma from './db'; // Use the singleton prisma instance
import { VerifyCallback } from 'passport-google-oauth20';
import env from './env';

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Missing Google OAuth environment variables');
}

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (accessToken: string, refreshToken: string, profile: Profile, done: VerifyCallback) => {
      try {
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(new Error('No email found from Google profile'));
        }

        let user = await prisma.user.findUnique({
          where: { email },
          include: { companies: { include: { competitors: true } } },
        });

        if (user) {
          // If user exists but signed up with credentials, link the account
          if (user.provider !== 'google') {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { provider: 'google', providerId: profile.id },
              include: { companies: { include: { competitors: true } } },
            });
          }
        } else {
          // If user does not exist, create a new one
          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName,
              provider: 'google',
              providerId: profile.id,
            },
            include: { companies: { include: { competitors: true } } },
          });
        }
        
        return done(null, user);
      } catch (error) {
        if (error instanceof Error) {
            return done(error);
        }
        return done(new Error('An unknown error occurred during authentication'));
      }
    }
  )
);

passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
    try {
        const user = await prisma.user.findUnique({ where: { id }, include: { companies: { include: { competitors: true } } } });
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

export default passport; 