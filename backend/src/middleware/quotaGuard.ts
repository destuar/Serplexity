import { NextFunction, Request, Response } from "express";
import { getDbClient } from "../config/database";
import { getPlanLimitsForUser } from "../services/planService";

export async function enforceCompanyCap(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (req.user?.role === "ADMIN") return next();
    const prisma = await getDbClient();
    const limits = await getPlanLimitsForUser(userId);
    if (limits.companyProfiles === null) return next();
    const count = await prisma.company.count({ where: { userId } });
    if (count >= limits.companyProfiles) {
      return res.status(400).json({ error: "Maximum company limit reached" });
    }
    return next();
  } catch (e) {
    return res.status(500).json({ error: "Internal server error" });
  }
}
