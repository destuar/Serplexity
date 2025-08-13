import Stripe from "stripe";
import { getDbClient } from "../config/database";
import env from "../config/env";
import {
  BillingInterval,
  PLAN_CONFIG,
  PlanLimits,
  PlanTier,
} from "./planService";

const RESPONSE_UNIT_PRICE_CENTS = 14; // $0.14 per response
const SENTIMENT_UNIT_PRICE_CENTS = 94; // $0.94 per sentiment unit
const MIN_BUDGET_CENTS = 1000; // $10

const stripe = new Stripe(env.STRIPE_SECRET_KEY as string);

export interface BillingSummary {
  includedReportsLimit: number;
  reportsUsed: number;
  reportsLeft: number;
  overageResponseCount: number;
  overageSentimentCount: number;
  overageAmountCents: number;
  budgetEnabled: boolean;
  overageBudgetCents: number | null;
  budgetRemainingCents: number;
  planTier: PlanTier;
  billingInterval: BillingInterval;
  periodStart: string;
  periodEnd: string;
}

export function getNextPeriodEnd(from: Date, interval: BillingInterval): Date {
  const end = new Date(from);
  if (interval === "ANNUAL") {
    end.setFullYear(end.getFullYear() + 1);
  } else {
    end.setMonth(end.getMonth() + 1);
  }
  return end;
}

export async function ensureBillingSettingsForUser(
  userId: string,
  defaultTier: PlanTier = "STARTER",
  defaultInterval: BillingInterval = "MONTHLY"
) {
  const prisma = await getDbClient();
  let settings = await prisma.userBillingSettings.findUnique({
    where: { userId },
  });
  if (!settings) {
    // Attempt to read stripeCustomerId from User
    const user = await prisma.user.findUnique({ where: { id: userId } });
    settings = await prisma.userBillingSettings.create({
      data: {
        userId,
        planTier: defaultTier,
        billingInterval: defaultInterval,
        stripeCustomerId: user?.stripeCustomerId || `pending_${userId}`,
      },
    });
  }
  return settings;
}

export async function ensureOpenBillingPeriod(userId: string): Promise<{
  id: string;
  periodStart: Date;
  periodEnd: Date;
  includedReportsLimit: number;
}> {
  const prisma = await getDbClient();
  const settings = await ensureBillingSettingsForUser(userId);
  const tier = (settings.planTier as PlanTier) || "STARTER";
  const interval = (settings.billingInterval as BillingInterval) || "MONTHLY";
  const limits: PlanLimits = PLAN_CONFIG[tier];

  // Try to find an OPEN period that covers now
  const now = new Date();
  const existing = await prisma.userBillingPeriod.findFirst({
    where: {
      userId,
      state: "OPEN",
      periodStart: { lte: now },
      periodEnd: { gt: now },
    },
    orderBy: { periodStart: "desc" },
  });
  if (existing) {
    return {
      id: existing.id,
      periodStart: existing.periodStart,
      periodEnd: existing.periodEnd,
      includedReportsLimit: existing.includedReportsLimit,
    };
  }

  // Create a new billing period starting now → next interval
  const periodStart = settings.currentPeriodStart ?? now;
  const periodEnd =
    settings.currentPeriodEnd ?? getNextPeriodEnd(periodStart, interval);

  const created = await prisma.userBillingPeriod.create({
    data: {
      userId,
      periodStart,
      periodEnd,
      includedReportsLimit: limits.reportsPerMonth,
    },
  });

  // Update settings with period bounds for UI
  await prisma.userBillingSettings.update({
    where: { userId },
    data: {
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  return {
    id: created.id,
    periodStart: created.periodStart,
    periodEnd: created.periodEnd,
    includedReportsLimit: created.includedReportsLimit,
  };
}

export async function getCurrentBillingSummary(
  userId: string
): Promise<BillingSummary> {
  const prisma = await getDbClient();
  const settings = await ensureBillingSettingsForUser(userId);
  const period = await ensureOpenBillingPeriod(userId);

  const periodRow = await prisma.userBillingPeriod.findUnique({
    where: { id: period.id },
  });
  if (!periodRow) {
    throw new Error("Billing period not found after ensure");
  }

  const holds = await prisma.budgetHold.findMany({
    where: {
      userId,
      billingPeriodId: periodRow.id,
      status: { in: ["HELD", "APPLIED"] },
    },
  });
  const heldCents = holds.reduce((sum, h) => sum + h.amountCents, 0);
  const spentCents = periodRow.overageAmountCents;
  const budget = settings.overageBudgetCents ?? 0;
  const remaining = Math.max(0, budget - spentCents - heldCents);

  return {
    includedReportsLimit: periodRow.includedReportsLimit,
    reportsUsed: periodRow.reportsUsed,
    reportsLeft: Math.max(
      0,
      periodRow.includedReportsLimit - periodRow.reportsUsed
    ),
    overageResponseCount: periodRow.overageResponseCount,
    overageSentimentCount: periodRow.overageSentimentCount,
    overageAmountCents: periodRow.overageAmountCents,
    budgetEnabled: !!settings.budgetEnabled,
    overageBudgetCents: settings.overageBudgetCents ?? null,
    budgetRemainingCents: remaining,
    planTier: (settings.planTier as PlanTier) ?? "STARTER",
    billingInterval: (settings.billingInterval as BillingInterval) ?? "MONTHLY",
    periodStart: periodRow.periodStart.toISOString(),
    periodEnd: periodRow.periodEnd.toISOString(),
  };
}

export async function setOverageBudget(
  userId: string,
  budgetCents: number,
  enabled: boolean
): Promise<void> {
  if (enabled && budgetCents < MIN_BUDGET_CENTS) {
    throw new Error("Minimum overage budget is $50");
  }
  const prisma = await getDbClient();
  await ensureBillingSettingsForUser(userId);
  await prisma.userBillingSettings.update({
    where: { userId },
    data: {
      overageBudgetCents: enabled ? budgetCents : null,
      budgetEnabled: enabled,
    },
  });
}

export async function setPlan(
  userId: string,
  tier: PlanTier,
  interval: BillingInterval
): Promise<void> {
  const prisma = await getDbClient();
  await ensureBillingSettingsForUser(userId);
  await prisma.userBillingSettings.update({
    where: { userId },
    data: { planTier: tier, billingInterval: interval },
  });
}

function aggregateEventsByDay(
  events: Array<{
    occurredAt: Date;
    type: "RESPONSE" | "SENTIMENT";
    quantity: number;
    isOverage: boolean;
    unitPriceCents: number;
  }>
) {
  const byDay = new Map<
    string,
    {
      responses: number;
      sentiments: number;
      overageResponses: number;
      overageSentiments: number;
      amountCents: number;
    }
  >();

  for (const e of events) {
    const day = new Date(e.occurredAt);
    day.setHours(0, 0, 0, 0);
    const key = day.toISOString();
    if (!byDay.has(key)) {
      byDay.set(key, {
        responses: 0,
        sentiments: 0,
        overageResponses: 0,
        overageSentiments: 0,
        amountCents: 0,
      });
    }
    const bucket = byDay.get(key)!;
    if (e.type === "RESPONSE") {
      bucket.responses += e.quantity;
      if (e.isOverage) bucket.overageResponses += e.quantity;
    } else {
      bucket.sentiments += e.quantity;
      if (e.isOverage) bucket.overageSentiments += e.quantity;
    }
    if (e.isOverage) bucket.amountCents += e.quantity * e.unitPriceCents;
  }
  return byDay;
}

function fillDailySeries(
  start: Date,
  end: Date,
  byDay: Map<
    string,
    {
      responses: number;
      sentiments: number;
      overageResponses: number;
      overageSentiments: number;
      amountCents: number;
    }
  >
) {
  const out: Array<{
    date: string;
    responses: number;
    sentiments: number;
    overageResponses: number;
    overageSentiments: number;
    amountCents: number;
  }> = [];
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getTime() + ONE_DAY_MS)
  ) {
    const key = new Date(d).setHours(0, 0, 0, 0);
    const iso = new Date(key).toISOString();
    const bucket = byDay.get(iso) || {
      responses: 0,
      sentiments: 0,
      overageResponses: 0,
      overageSentiments: 0,
      amountCents: 0,
    };
    out.push({ date: iso, ...bucket });
  }
  return out;
}

export async function getUsageTimeSeries(
  userId: string,
  windowDays: number = 30
): Promise<
  Array<{
    date: string;
    responses: number;
    sentiments: number;
    overageResponses: number;
    overageSentiments: number;
    amountCents: number;
  }>
> {
  const prisma = await getDbClient();
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  // Aggregate usage by day
  const events = await prisma.usageEvent.findMany({
    where: { userId, occurredAt: { gte: since } },
    orderBy: { occurredAt: "asc" },
    select: {
      occurredAt: true,
      type: true,
      quantity: true,
      isOverage: true,
      unitPriceCents: true,
    },
  });
  const byDay = aggregateEventsByDay(events);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  return fillDailySeries(since, end, byDay);
}

export async function getReportsTimeSeries(
  userId: string,
  options: { start?: Date; end?: Date; days?: number } = {}
): Promise<
  Array<{
    date: string;
    reports: number;
  }>
> {
  const prisma = await getDbClient();
  let start: Date;
  let end: Date;
  if (options.start && options.end) {
    start = new Date(options.start);
    end = new Date(options.end);
  } else {
    const days = Math.max(1, options.days ?? 30);
    end = new Date();
    end.setHours(0, 0, 0, 0);
    start = new Date(end);
    start.setDate(start.getDate() - days + 1);
  }

  const runs = await prisma.reportRun.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      company: { userId },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, number>();
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  // seed dates to zero
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getTime() + ONE_DAY_MS)
  ) {
    const key = new Date(new Date(d).setHours(0, 0, 0, 0)).toISOString();
    byDay.set(key, 0);
  }

  for (const r of runs) {
    const key = new Date(
      new Date(r.createdAt).setHours(0, 0, 0, 0)
    ).toISOString();
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }

  const out: Array<{ date: string; reports: number }> = [];
  for (
    let d = new Date(start);
    d <= end;
    d = new Date(d.getTime() + ONE_DAY_MS)
  ) {
    const key = new Date(new Date(d).setHours(0, 0, 0, 0)).toISOString();
    out.push({ date: key, reports: byDay.get(key) ?? 0 });
  }
  return out;
}

async function createOverageInvoice(
  stripeClient: Stripe,
  customerId: string,
  period: {
    userId: string;
    id: string;
    periodStart: Date;
    periodEnd: Date;
    overageResponseCount: number;
    overageSentimentCount: number;
  }
): Promise<string | null> {
  const addItems: Array<() => Promise<unknown>> = [];
  if (period.overageResponseCount > 0) {
    addItems.push(() =>
      stripeClient.invoiceItems.create({
        customer: customerId,
        currency: "usd",
        amount: RESPONSE_UNIT_PRICE_CENTS * period.overageResponseCount,
        description: "Overage: Responses",
      })
    );
  }
  if (period.overageSentimentCount > 0) {
    addItems.push(() =>
      stripeClient.invoiceItems.create({
        customer: customerId,
        currency: "usd",
        amount: SENTIMENT_UNIT_PRICE_CENTS * period.overageSentimentCount,
        description: "Overage: Sentiment Analyses",
      })
    );
  }
  for (const add of addItems) await add();
  const created = await stripeClient.invoices.create({
    customer: customerId,
    collection_method: "charge_automatically",
    description: `Overage for ${period.periodStart.toISOString()} – ${period.periodEnd.toISOString()}`,
    metadata: { userId: period.userId, periodId: period.id, type: "overage" },
  });
  const finalized = await stripeClient.invoices.finalizeInvoice(
    created.id as string
  );
  return finalized.id as string;
}

export async function closeDueBillingPeriods(): Promise<number> {
  const prisma = await getDbClient();
  const now = new Date();
  const due = await prisma.userBillingPeriod.findMany({
    where: { state: "OPEN", periodEnd: { lte: now } },
    orderBy: { periodEnd: "asc" },
  });

  let processed = 0;
  for (const period of due) {
    try {
      const settings = await prisma.userBillingSettings.findUnique({
        where: { userId: period.userId },
      });
      const hasOverage =
        period.overageResponseCount > 0 || period.overageSentimentCount > 0;

      if (!hasOverage) {
        await prisma.userBillingPeriod.update({
          where: { id: period.id },
          data: { state: "CLOSED" },
        });
        processed++;
        continue;
      }

      let invoiceId: string | null = null;
      if (settings?.stripeCustomerId) {
        invoiceId = await createOverageInvoice(
          stripe,
          settings.stripeCustomerId,
          period
        );
      }

      await prisma.userBillingPeriod.update({
        where: { id: period.id },
        data: {
          state: "INVOICED",
          stripeOverageInvoiceId: invoiceId ?? null,
        },
      });

      await ensureOpenBillingPeriod(period.userId);
      processed++;
    } catch {
      // keep iterating; will retry next day
    }
  }
  return processed;
}
