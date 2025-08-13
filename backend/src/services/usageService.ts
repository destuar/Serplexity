import { getDbClient } from "../config/database";
import { getPlanLimitsForUser, getReportsLeftThisPeriod } from "./planService";

const RESPONSE_UNIT_PRICE_CENTS = 14; // $0.14 per response
const SENTIMENT_UNIT_PRICE_CENTS = 94; // $0.94 per sentiment unit
const MIN_BUDGET_CENTS = 1000; // $10

export async function startReportForBilling(
  userId: string,
  companyId: string,
  runId: string,
  requestedPrompts: number,
  requestedModels: number
): Promise<{ isOverage: boolean }> {
  const prisma = await getDbClient();
  // Admins bypass billing checks entirely
  try {
    const adminUser = await prisma.user.findUnique({ where: { id: userId } });
    if (adminUser?.role === "ADMIN") {
      await prisma.reportRun.update({
        where: { id: runId },
        data: { isOverage: false },
      });
      return { isOverage: false };
    }
  } catch {}
  const limits = await getPlanLimitsForUser(userId);

  const { reportsLeft } = await getReportsLeftThisPeriod(userId);

  const isOverage = reportsLeft <= 0;

  if (!isOverage) {
    // Increment reportsUsed
    await prisma.userBillingPeriod.updateMany({
      where: { userId, state: "OPEN" },
      data: { reportsUsed: { increment: 1 } },
    });
    await prisma.reportRun.update({
      where: { id: runId },
      data: { isOverage: false },
    });
    return { isOverage: false };
  }

  // Overage: require budget enabled and sufficient available budget
  const settings = await prisma.userBillingSettings.findUnique({
    where: { userId },
  });
  if (
    !settings ||
    !settings.budgetEnabled ||
    (settings.overageBudgetCents ?? 0) < MIN_BUDGET_CENTS
  ) {
    throw new Error(
      "Overage budget required (min $10) to run additional reports this period"
    );
  }

  const period = await prisma.userBillingPeriod.findFirst({
    where: { userId, state: "OPEN" },
    orderBy: { periodStart: "desc" },
  });
  if (!period) {
    throw new Error("Active billing period not found");
  }

  const prompts = Math.min(requestedPrompts, limits.promptsPerReportMax);
  const models = Math.min(requestedModels, limits.modelsPerReportMax);
  const responsesEstimate = prompts * models;
  const sentimentsEstimate = models; // one per selected sentiment model

  const holdCents =
    responsesEstimate * RESPONSE_UNIT_PRICE_CENTS +
    sentimentsEstimate * SENTIMENT_UNIT_PRICE_CENTS;

  // Compute spent + held so far to calculate remaining
  const holds = await prisma.budgetHold.findMany({
    where: {
      userId,
      billingPeriodId: period.id,
      status: { in: ["HELD", "APPLIED"] },
    },
  });
  const heldCents = holds.reduce((sum, h) => sum + h.amountCents, 0);
  const spentCents = period.overageAmountCents;
  const budget = settings.overageBudgetCents ?? 0;
  const remaining = budget - spentCents - heldCents;
  if (remaining < holdCents) {
    throw new Error(
      "Insufficient remaining overage budget to start this report"
    );
  }

  await prisma.$transaction([
    prisma.budgetHold.create({
      data: {
        userId,
        billingPeriodId: period.id,
        reportRunId: runId,
        amountCents: holdCents,
        status: "HELD",
      },
    }),
    prisma.reportRun.update({
      where: { id: runId },
      data: { isOverage: true },
    }),
  ]);

  return { isOverage: true };
}

export async function recordResponseUsage(
  userId: string,
  _companyId: string,
  runId: string,
  quantity: number = 1
): Promise<void> {
  const prisma = await getDbClient();
  const run = await prisma.reportRun.findUnique({
    where: { id: runId },
    select: { isOverage: true },
  });
  if (!run) return;
  const period = await prisma.userBillingPeriod.findFirst({
    where: { userId, state: "OPEN" },
    orderBy: { periodStart: "desc" },
  });
  if (!period) return;

  const isOverage = !!run.isOverage;

  await prisma.usageEvent.create({
    data: {
      userId,
      companyId: _companyId,
      reportRunId: runId,
      billingPeriodId: period.id,
      type: "RESPONSE",
      quantity,
      unitPriceCents: RESPONSE_UNIT_PRICE_CENTS,
      isOverage,
    },
  });

  if (isOverage) {
    await prisma.userBillingPeriod.update({
      where: { id: period.id },
      data: {
        overageResponseCount: { increment: quantity },
        overageAmountCents: { increment: quantity * RESPONSE_UNIT_PRICE_CENTS },
      },
    });
  }
}

export async function recordSentimentUsage(
  userId: string,
  _companyId: string,
  runId: string,
  quantity: number = 1
): Promise<void> {
  const prisma = await getDbClient();
  const run = await prisma.reportRun.findUnique({
    where: { id: runId },
    select: { isOverage: true },
  });
  if (!run) return;
  const period = await prisma.userBillingPeriod.findFirst({
    where: { userId, state: "OPEN" },
    orderBy: { periodStart: "desc" },
  });
  if (!period) return;

  const isOverage = !!run.isOverage;

  await prisma.usageEvent.create({
    data: {
      userId,
      companyId: _companyId,
      reportRunId: runId,
      billingPeriodId: period.id,
      type: "SENTIMENT",
      quantity,
      unitPriceCents: SENTIMENT_UNIT_PRICE_CENTS,
      isOverage,
    },
  });

  if (isOverage) {
    await prisma.userBillingPeriod.update({
      where: { id: period.id },
      data: {
        overageSentimentCount: { increment: quantity },
        overageAmountCents: {
          increment: quantity * SENTIMENT_UNIT_PRICE_CENTS,
        },
      },
    });
  }
}

export async function finalizeReportForBilling(
  userId: string,
  runId: string
): Promise<void> {
  const prisma = await getDbClient();
  const run = await prisma.reportRun.findUnique({
    where: { id: runId },
    select: { isOverage: true, companyId: true },
  });
  if (!run) return;
  if (!run.isOverage) return; // Nothing to settle
  const period = await prisma.userBillingPeriod.findFirst({
    where: { userId, state: "OPEN" },
    orderBy: { periodStart: "desc" },
  });
  if (!period) return;

  // Apply the hold: find the hold for this run and mark APPLIED
  const hold = await prisma.budgetHold.findFirst({
    where: {
      userId,
      billingPeriodId: period.id,
      reportRunId: runId,
      status: "HELD",
    },
  });
  if (hold) {
    await prisma.budgetHold.update({
      where: { id: hold.id },
      data: { status: "APPLIED" },
    });
  }
}

export async function releaseReportHold(
  userId: string,
  runId: string
): Promise<void> {
  const prisma = await getDbClient();
  const period = await prisma.userBillingPeriod.findFirst({
    where: { userId, state: "OPEN" },
    orderBy: { periodStart: "desc" },
  });
  if (!period) return;
  const hold = await prisma.budgetHold.findFirst({
    where: {
      userId,
      billingPeriodId: period.id,
      reportRunId: runId,
      status: "HELD",
    },
  });
  if (hold) {
    await prisma.budgetHold.update({
      where: { id: hold.id },
      data: { status: "RELEASED" },
    });
  }
}
