import { getDbClient } from "../config/database";

export type PlanTier = "STARTER" | "GROWTH" | "SCALE";
export type BillingInterval = "MONTHLY" | "ANNUAL";

export interface PlanLimits {
  companyProfiles: number | null; // null = unlimited
  seats: number;
  reportsPerMonth: number;
  modelsPerReportMax: number;
  promptsPerReportMax: number;
  webAuditsUnlimited: true;
}

export const PLAN_CONFIG: Record<PlanTier, PlanLimits> = {
  STARTER: {
    companyProfiles: 1,
    seats: 1,
    reportsPerMonth: 10,
    modelsPerReportMax: 2,
    promptsPerReportMax: 10,
    webAuditsUnlimited: true,
  },
  GROWTH: {
    companyProfiles: 3,
    seats: 5,
    reportsPerMonth: 30,
    modelsPerReportMax: 4,
    promptsPerReportMax: 20,
    webAuditsUnlimited: true,
  },
  SCALE: {
    companyProfiles: null,
    seats: 15,
    reportsPerMonth: 60,
    modelsPerReportMax: 4,
    promptsPerReportMax: 20,
    webAuditsUnlimited: true,
  },
};

/**
 * Generate default model preferences based on plan limits.
 * STARTER → Enable: ai-overview, gpt-4.1-mini, sonar. Disable: gemini, claude.
 * GROWTH/SCALE (modelsPerReportMax >= 4) → Enable all five models by default.
 */
export function getDefaultModelPreferencesFromLimits(
  limits: PlanLimits
): Record<string, boolean> {
  const isGrowthOrAbove = limits.modelsPerReportMax >= 4;
  if (isGrowthOrAbove) {
    return {
      "gpt-4.1-mini": true,
      "claude-3-5-haiku-20241022": true,
      "gemini-2.5-flash": true,
      sonar: true,
      "ai-overview": true,
    };
  }
  // STARTER defaults
  return {
    "gpt-4.1-mini": true,
    "claude-3-5-haiku-20241022": false,
    "gemini-2.5-flash": false,
    sonar: true,
    "ai-overview": true,
  };
}

export async function getPlanLimitsForUser(
  userId: string
): Promise<PlanLimits> {
  const prisma = await getDbClient();
  // For now, read from our new billing settings if available; default to STARTER
  const settings = await prisma.userBillingSettings.findUnique({
    where: { userId },
  });
  const tier = (settings?.planTier as PlanTier) || "STARTER";
  return PLAN_CONFIG[tier];
}

export async function getReportsLeftThisPeriod(userId: string): Promise<{
  includedReportsLimit: number;
  reportsUsed: number;
  reportsLeft: number;
}> {
  const prisma = await getDbClient();
  const period = await prisma.userBillingPeriod.findFirst({
    where: { userId, state: "OPEN" },
    orderBy: { periodStart: "desc" },
  });
  if (!period) {
    const limits = await getPlanLimitsForUser(userId);
    return {
      includedReportsLimit: limits.reportsPerMonth,
      reportsUsed: 0,
      reportsLeft: limits.reportsPerMonth,
    };
  }
  const reportsLeft = Math.max(
    0,
    period.includedReportsLimit - period.reportsUsed
  );
  return {
    includedReportsLimit: period.includedReportsLimit,
    reportsUsed: period.reportsUsed,
    reportsLeft,
  };
}

export function clampModelsPerReport(
  requested: number,
  limits: PlanLimits
): number {
  return Math.min(requested, limits.modelsPerReportMax);
}

export function clampPromptsPerReport(
  requested: number,
  limits: PlanLimits
): number {
  return Math.min(requested, limits.promptsPerReportMax);
}
