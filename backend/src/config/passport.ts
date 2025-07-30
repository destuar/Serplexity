/**
 * @file passport.ts
 * @description This file configures the Passport.js authentication strategies, specifically for Google OAuth 2.0.
 * It handles user lookup, creation, and account linking. It also includes the serialization and deserialization of the user,
 * which is essential for maintaining login sessions.
 *
 * @dependencies
 * - passport: The core Passport.js library.
 * - passport-google-oauth20: The Passport.js strategy for Google OAuth 2.0.
 * - ./db: The singleton Prisma client instance for database interactions.
 * - ./env: Environment variable configuration.
 *
 * @exports
 * - passport: The configured Passport.js instance.
 */
import passport from "passport";
import { Strategy as GoogleStrategy, Profile } from "passport-google-oauth20";
import { getDbClient } from "./database";
import { VerifyCallback } from "passport-google-oauth20";
import env from "./env";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL } = env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing Google OAuth environment variables");
}

passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_CALLBACK_URL,
    },
    async (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: VerifyCallback,
    ) => {
      try {
        const prisma = await getDbClient();
        const email = profile.emails?.[0].value;
        if (!email) {
          return done(new Error("No email found from Google profile"));
        }

        let user = await prisma.user.findUnique({
          where: { email },
          include: { companies: { include: { competitors: true } } },
        });

        if (user) {
          // If user exists but signed up with credentials, link the account
          if (user.provider !== "google") {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { provider: "google", providerId: profile.id },
              include: { companies: { include: { competitors: true } } },
            });
          }
        } else {
          // If user does not exist, create a new one with trial information
          const trialStartedAt = new Date();
          const trialEndsAt = new Date(trialStartedAt.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

          user = await prisma.user.create({
            data: {
              email,
              name: profile.displayName,
              provider: "google",
              providerId: profile.id,
              trialStartedAt,
              trialEndsAt,
              subscriptionStatus: "trialing",
            },
            include: { companies: { include: { competitors: true } } },
          });
        }

        return done(null, user);
      } catch (error) {
        if (error instanceof Error) {
          return done(error);
        }
        return done(
          new Error("An unknown error occurred during authentication"),
        );
      }
    },
  ),
);

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const prisma = await getDbClient();
    const user = await prisma.user.findUnique({
      where: { id },
      include: { companies: { include: { competitors: true } } },
    });
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
