import { NextFunction, Request, Response } from "express";

export function subscriptionGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (user.role === "ADMIN") return next();
  if (user.subscriptionStatus === "active") return next();
  return res.status(403).json({ error: "Subscription required" });
}
