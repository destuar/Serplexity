import { Request, Response } from "express";
import { z } from "zod";
import {
  BillingSummary,
  getCurrentBillingSummary,
  getReportsTimeSeries,
  getUsageTimeSeries,
  setOverageBudget,
  setPlan,
} from "../services/billingService";
import Stripe from "stripe";
import env from "../config/env";

const setBudgetSchema = z.object({
  enabled: z.boolean(),
  budgetCents: z.number().int().nonnegative().optional(),
});

const setPlanSchema = z.object({
  tier: z.enum(["STARTER", "GROWTH", "SCALE"]),
  interval: z.enum(["MONTHLY", "ANNUAL"]),
});

export async function getBillingSummary(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const summary: BillingSummary = await getCurrentBillingSummary(userId);
    return res.json(summary);
  } catch {
    return res.status(500).json({ error: "Failed to fetch billing summary" });
  }
}

export async function getUsageSeries(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const q = req.query as Record<string, string | undefined>;
    const start = q["start"] ? new Date(q["start"] as string) : undefined;
    const end = q["end"] ? new Date(q["end"] as string) : undefined;
    const daysParam = q["days"];
    let series;
    if (start && end) {
      const days = Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1
      );
      series = await getUsageTimeSeries(userId, days);
    } else {
      const days = Math.min(365, Math.max(1, Number(daysParam ?? 30)));
      series = await getUsageTimeSeries(userId, days);
    }
    return res.json(series);
  } catch {
    return res.status(500).json({ error: "Failed to fetch usage series" });
  }
}

export async function getReportsSeries(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const q = req.query as Record<string, string | undefined>;
    const start = q["start"] ? new Date(q["start"] as string) : undefined;
    const end = q["end"] ? new Date(q["end"] as string) : undefined;
    const daysParam = q["days"];
    let series;
    if (start && end) {
      series = await getReportsTimeSeries(userId, { start, end });
    } else {
      const days = Math.min(365, Math.max(1, Number(daysParam ?? 30)));
      series = await getReportsTimeSeries(userId, { days });
    }
    return res.json(series);
  } catch {
    return res.status(500).json({ error: "Failed to fetch reports series" });
  }
}

export async function updateBudget(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    // Persist toggle even for ADMIN for UI consistency; admins remain unlimited regardless
    const { enabled, budgetCents } = setBudgetSchema.parse(req.body);
    const cents = enabled ? (budgetCents ?? 0) : 0;
    await setOverageBudget(userId, cents, enabled);
    return res.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors });
    }
    return res.status(400).json({ error: (e as Error).message });
  }
}

export async function updatePlan(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    if (req.user?.role === "ADMIN") {
      // Admins do not need a plan; acknowledge
      return res.json({ ok: true, note: "Admin bypass: plan not required" });
    }
    const { tier, interval } = setPlanSchema.parse(req.body);
    await setPlan(userId, tier, interval);
    return res.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return res.status(400).json({ error: e.errors });
    }
    return res.status(400).json({ error: (e as Error).message });
  }
}

export async function getInvoiceHistory(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    
    // Get user's stripe customer ID
    const user = req.user;
    if (!user?.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    const stripe = new Stripe(env.STRIPE_SECRET_KEY as string);
    
    // Fetch invoices from Stripe
    const invoices = await stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 20,
      status: 'paid'
    });

    const invoiceHistory = invoices.data.map(invoice => ({
      id: invoice.id,
      amount: invoice.total / 100, // Convert from cents to dollars
      status: invoice.status,
      created: invoice.created,
      periodStart: invoice.period_start,
      periodEnd: invoice.period_end,
      invoicePdf: invoice.invoice_pdf
    }));

    return res.json({ invoices: invoiceHistory });
  } catch (error) {
    console.error('Failed to fetch invoice history:', error);
    return res.status(500).json({ error: "Failed to fetch invoice history" });
  }
}
