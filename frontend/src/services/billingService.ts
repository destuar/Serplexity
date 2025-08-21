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
  daysOrParams: number | { start: string; end: string; granularity?: string }
): Promise<UsagePoint[]> {
  if (typeof daysOrParams === "number") {
    const { data } = await api.get(`/billing/usage?days=${daysOrParams}`);
    return data as UsagePoint[];
  }
  const params = new URLSearchParams(
    daysOrParams as Record<string, string>
  ).toString();
  const { data } = await api.get(`/billing/usage?${params}`);
  return data as UsagePoint[];
}

export async function updateBudget(options: {
  enabled: boolean;
  budgetCents?: number;
}) {
  await api.post("/billing/budget", options);
}

// New interfaces for report history
export interface ReportRunHistory {
  id: string;
  createdAt: string;
  companyName: string;
  promptCount: number | null;
  responseCount: number | null;
}

export interface UsageStatistics {
  totalWorkspaces: number;
  totalReports: number;
  totalActivePrompts: number;
  totalResponses: number;
}

// New API functions for enhanced usage data
export async function fetchReportHistory(options?: {
  days?: number;
  limit?: number;
}): Promise<ReportRunHistory[]> {
  const params = new URLSearchParams();
  if (options?.days) params.append('days', options.days.toString());
  if (options?.limit) params.append('limit', options.limit.toString());
  
  const { data } = await api.get(`/usage/reports?${params.toString()}`);
  return data as ReportRunHistory[];
}

export async function fetchUsageStatistics(): Promise<UsageStatistics> {
  const { data } = await api.get("/usage/stats");
  return data as UsageStatistics;
}

export interface InvoiceHistoryItem {
  id: string;
  amount: number;
  status: 'paid' | 'open' | 'void' | 'draft';
  created: number;
  periodStart: number;
  periodEnd: number;
  invoicePdf?: string;
}

export async function fetchInvoiceHistory(): Promise<InvoiceHistoryItem[]> {
  const { data } = await api.get("/billing/invoices");
  return data.invoices as InvoiceHistoryItem[];
}

export async function updatePlan(options: {
  tier: "STARTER" | "GROWTH" | "SCALE";
  interval: "MONTHLY" | "ANNUAL";
}) {
  await api.post("/billing/plan", options);
}
