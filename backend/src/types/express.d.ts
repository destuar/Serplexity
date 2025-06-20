import { Role } from '@prisma/client';

declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      email: string;
      name: string | null;
      role: Role;
      tokenVersion: number;
      subscriptionStatus: string | null;
      stripeCustomerId: string | null;
    };
  }
}

// This is needed to make this file a module.
export {}; 