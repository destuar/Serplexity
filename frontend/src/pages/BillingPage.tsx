import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/apiClient";
import {
  BillingSummary,
  fetchBillingSummary,
  fetchUsageSeries,
  updateBudget,
} from "../services/billingService";

export default function BillingPage() {
  const { user: _user } = useAuth();
  const [summary, setSummary] = useState<BillingSummary | null>(null);
  interface ReportSeriesPoint {
    date: string;
    reports: number;
    responses?: number;
    sentiments?: number;
    amountCents?: number;
  }
  const [series, setSeries] = useState<ReportSeriesPoint[]>([]);
  const [chartMode, setChartMode] = useState<"reports" | "responses">(
    "reports"
  );
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [budgetEnabled, setBudgetEnabled] = useState(false);
  const [budgetDollars, setBudgetDollars] = useState<number>(50);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const s = await fetchBillingSummary();
        if (!mounted) return;
        setSummary(s);
        setBudgetEnabled(s.budgetEnabled);
        setBudgetDollars((s.overageBudgetCents ?? 5000) / 100);
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        const startIso = new Date(start.setHours(0, 0, 0, 0)).toISOString();
        const endIso = new Date(end.setHours(0, 0, 0, 0)).toISOString();
        setDateRange({ start: startIso, end: endIso });
        const { data } = await api.get(
          `/billing/reports?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
        );
        setSeries(data);
      } catch {
        setError("Failed to load billing data");
      } finally {
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const onSaveBudget = async () => {
    const cents = Math.round(Math.max(50, budgetDollars) * 100);
    await updateBudget({ enabled: budgetEnabled, budgetCents: cents });
    const s = await fetchBillingSummary();
    setSummary(s);
  };

  const refreshSeries = async (
    mode: "reports" | "responses",
    range: { start: string; end: string }
  ) => {
    if (mode === "reports") {
      const { data } = await api.get(
        `/billing/reports?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`
      );
      setSeries(data);
    } else {
      const data = await fetchUsageSeries({
        start: range.start,
        end: range.end,
      });
      setSeries(data);
    }
  };

  const setQuickRange = async (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const startIso = new Date(start.setHours(0, 0, 0, 0)).toISOString();
    const endIso = new Date(end.setHours(0, 0, 0, 0)).toISOString();
    const newRange = { start: startIso, end: endIso };
    setDateRange(newRange);
    await refreshSeries(chartMode, newRange);
  };

  if (loading) return <div className="p-6">Loading billing...</div>;
  if (error) return <div className="p-6 text-red-500">{error}</div>;
  if (!summary) return null;

  // Shared pill styles (mirror ProfileModal)
  const pillActive =
    "px-3 py-2 rounded-lg text-sm bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900 transition-colors select-none touch-manipulation";
  const pillInactive =
    "px-3 py-2 rounded-lg text-sm bg-white/80 backdrop-blur-sm border border-white/20 shadow text-gray-700 active:shadow-inner active:bg-white/60 active:border-white/30 transition-colors select-none touch-manipulation";

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Billing</h1>
      {/* Plan card */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-400">Current plan</div>
          <div className="text-xl font-medium">
            {summary.planTier} • {summary.billingInterval.toLowerCase()}
          </div>
          <div className="text-xs text-gray-500">
            Included reports: {summary.includedReportsLimit} · Period:{" "}
            {new Date(summary.periodStart).toLocaleDateString()} -{" "}
            {new Date(summary.periodEnd).toLocaleDateString()}
          </div>
        </div>
        <button
          className={pillInactive}
          onClick={() => (window.location.href = "/payment")}
        >
          {_user?.subscriptionStatus === "active"
            ? "Manage Subscription"
            : `Upgrade to ${summary.planTier}`}
        </button>
      </div>

      {/* Budget card */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Usage-based budget</div>
            <div className="text-sm text-gray-400">
              Controls spending on overage beyond included reports.
            </div>
          </div>
          <div className="text-xl font-medium">
            ${budgetEnabled ? budgetDollars.toFixed(0) : "0"}
          </div>
        </div>
        <div>
          <button
            className={pillInactive}
            onClick={() => {
              const next = window.prompt(
                "Set monthly budget ($, min 50)",
                String(budgetDollars)
              );
              if (!next) return;
              const dollars = Math.max(50, Math.round(Number(next)) || 0);
              setBudgetDollars(dollars);
              setBudgetEnabled(true);
              void onSaveBudget();
            }}
          >
            Edit limit
          </button>
        </div>
      </div>

      {/* Credits card */}
      <div className="rounded-lg bg-white/5 border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">Credits</div>
            <div className="text-sm text-gray-400">
              Reports left: {summary.reportsLeft} of{" "}
              {summary.includedReportsLimit}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className={chartMode === "reports" ? pillActive : pillInactive}
              onClick={async () => {
                setChartMode("reports");
                if (dateRange) await refreshSeries("reports", dateRange);
              }}
            >
              Reports
            </button>
            <button
              className={chartMode === "responses" ? pillActive : pillInactive}
              onClick={async () => {
                setChartMode("responses");
                if (dateRange) await refreshSeries("responses", dateRange);
              }}
            >
              Responses
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <div className="text-gray-400">Range:</div>
          <button className={pillInactive} onClick={() => setQuickRange(1)}>
            1d
          </button>
          <button className={pillInactive} onClick={() => setQuickRange(7)}>
            7d
          </button>
          <button className={pillInactive} onClick={() => setQuickRange(30)}>
            30d
          </button>
        </div>
        <div className="mt-2 space-y-1 max-h-64 overflow-auto">
          {chartMode === "reports" &&
            series.map((d) => (
              <div
                key={d.date}
                className="flex items-center justify-between text-sm"
              >
                <div className="text-gray-400">
                  {new Date(d.date).toLocaleDateString()}
                </div>
                <div>{d.reports} reports</div>
              </div>
            ))}
          {chartMode === "responses" &&
            series.map((d) => (
              <div
                key={d.date}
                className="flex items-center justify-between text-sm"
              >
                <div className="text-gray-400">
                  {new Date(d.date).toLocaleDateString()}
                </div>
                <div>{d.responses ?? 0} responses</div>
              </div>
            ))}
        </div>
      </div>

      <div className="rounded-lg bg-white/5 border border-white/10 p-4">
        <div className="font-medium mb-2">Usage (30 days)</div>
        <div className="text-xs text-gray-400">
          Daily totals of responses, sentiments, and overage amount.
        </div>
        <div className="mt-2 space-y-1 max-h-64 overflow-auto">
          {series.map((d) => (
            <div
              key={d.date}
              className="flex items-center justify-between text-sm"
            >
              <div className="text-gray-400">
                {new Date(d.date).toLocaleDateString()}
              </div>
              <div>
                resp {d.responses} / sent {d.sentiments} / overage $
                {((d.amountCents ?? 0) / 100).toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
