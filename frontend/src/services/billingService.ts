import api from "../lib/apiClient";

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
  planTier: "STARTER" | "GROWTH" | "SCALE";
  billingInterval: "MONTHLY" | "ANNUAL";
  periodStart: string;
  periodEnd: string;
}

export async function fetchBillingSummary(): Promise<BillingSummary> {
  const { data } = await api.get("/billing/summary");
  return data as BillingSummary;
}

export interface UsagePoint {
  date: string;
  responses: number;
  sentiments: number;
  amountCents: number;
}

export async function fetchUsageSeries(
  daysOrParams: number | { start: string; end: string }
): Promise<UsagePoint[]> {
  if (typeof daysOrParams === "number") {
    const { data } = await api.get(`/billing/usage?days=${daysOrParams}`);
    return data as UsagePoint[];
  }
  const params = new URLSearchParams(daysOrParams as any).toString();
  const { data } = await api.get(`/billing/usage?${params}`);
  return data as UsagePoint[];
}

export async function updateBudget(options: {
  enabled: boolean;
  budgetCents?: number;
}) {
  await api.post("/billing/budget", options);
}

export async function updatePlan(options: {
  tier: "STARTER" | "GROWTH" | "SCALE";
  interval: "MONTHLY" | "ANNUAL";
}) {
  await api.post("/billing/plan", options);
}
