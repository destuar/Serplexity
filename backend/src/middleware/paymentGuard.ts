import { Request, Response, NextFunction } from 'express';

const ACTIVE_STATUSES = ['active', 'trialing'];

export const paymentGuard = (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;

  // Allow admins to bypass the payment guard
  if (user?.role === 'ADMIN') {
    return next();
  }

  if (!user || !user.subscriptionStatus || !ACTIVE_STATUSES.includes(user.subscriptionStatus)) {
    return res.status(403).json({ error: 'Forbidden: An active subscription is required for this action.' });
  }

  next();
}; 