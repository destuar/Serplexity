/**
 * @file ProfileModal.tsx
 * @description Modal component for user profile management, including profile editing, password changes, and account settings.
 * Provides a comprehensive interface for users to manage their account information and preferences.
 *
 * @dependencies
 * - react: For component state and rendering.
 * - lucide-react: For icons.
 * - ../../contexts/AuthContext: For user authentication and profile management.
 * - ../../services/companyService: For company-related API calls.
 *
 * @exports
 * - ProfileModal: The main profile modal component.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle,
  BarChart2,
  BookOpen,
  Box,
  CreditCard,
  Edit2,
  Globe,
  Lock,
  LogOut,
  Mail,
  Monitor,
  PieChart,
  Settings as SettingsIcon,
  Smartphone,
  Users,
  X,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { InlineSpinner } from "../ui/InlineSpinner";
// Note: buttonClasses and formClasses imports removed as they're unused
import { useNavigate } from "react-router-dom";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import apiClient from "../../lib/apiClient";
import {
  SessionDto,
  fetchMySessions,
  revokeMySession,
} from "../../services/authService";
import {
  BillingSummary,
  UsagePoint,
  fetchBillingSummary,
  fetchUsageSeries,
  updateBudget,
} from "../../services/billingService";
import {
  TeamMemberDto,
  getTeamLimits,
  getTeamMembers,
  inviteTeamMember,
  removeTeamMember,
} from "../../services/teamService";
import InlineIndustryAutocomplete from "../company/InlineIndustryAutocomplete";
import { Button } from "../ui/Button";

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Validation schemas
const profileUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
});

// Password schema and related handlers removed in this component revision

interface ApiError {
  response?: {
    data?: {
      error?: string;
    };
  };
  message: string;
}

type ProfileFormData = z.infer<typeof profileUpdateSchema>;
// type PasswordFormData = never;

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  // Removed unused password visibility states
  const [_isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [_profileError, setProfileError] = useState<string | null>(null);
  // Removed unused password/feedback states
  // Company profiles state
  const { companies, deleteCompany, updateCompany } = useCompany();
  const [editingCompany, setEditingCompany] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>("");
  const [editWebsite, setEditWebsite] = useState<string>("");
  const [editIndustry, setEditIndustry] = useState<string>("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);
  // Billing/Usage state
  const [billingSummary, setBillingSummary] = useState<BillingSummary | null>(
    null
  );
  const [usageSeries, setUsageSeries] = useState<
    Array<UsagePoint | { date: string; reports: number }>
  >([]);
  const [_billingLoading, setBillingLoading] = useState(false);
  const [_usageLoading, setUsageLoading] = useState(false);
  const [_billingError, setBillingError] = useState<string | null>(null);
  const [_usageError, setUsageError] = useState<string | null>(null);
  const [budgetEnabledLocal, setBudgetEnabledLocal] = useState(false);
  const [budgetDollars, setBudgetDollars] = useState<number>(50);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [proposedBudget, setProposedBudget] = useState<number>(50);
  const [customBudgetInput, setCustomBudgetInput] = useState<string>("");
  const [budgetErrorLocal, setBudgetErrorLocal] = useState<string | null>(null);
  // Removed unused selectedTier/selectedInterval states
  const [chartMode, setChartMode] = useState<"reports" | "responses">(
    "reports"
  );
  const [dateRange, setDateRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [selectedQuickDays, setSelectedQuickDays] = useState<number>(30);
  // Sessions
  const [sessions, setSessions] = useState<SessionDto[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  // Team
  const [teamMembers, setTeamMembers] = useState<TeamMemberDto[]>([]);
  const [seatLimits, setSeatLimits] = useState<{
    planTier: string;
    seatLimit: number;
    seatsUsed: number;
    seatsAvailable: number;
  } | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [selfEditing, setSelfEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] =
    useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const chartData = useMemo(() => {
    return usageSeries.map((d) => {
      const dt = new Date(d.date);
      const dateLabel = dt.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const value =
        chartMode === "reports"
          ? "reports" in d
            ? (d.reports ?? 0)
            : 0
          : "responses" in d
            ? (d.responses ?? 0)
            : 0;
      return {
        dateLabel,
        value,
      };
    });
  }, [usageSeries, chartMode]);

  // Profile form
  const {
    register: registerProfile,
    handleSubmit: handleSubmitProfile,
    formState: { errors: _profileErrors },
    reset: resetProfile,
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
    },
  });

  // Password form
  // Removed unused password form

  // no-op on open for companies
  useEffect(() => {}, [isOpen]);

  // Update form values when user data changes
  useEffect(() => {
    if (user) {
      resetProfile({
        name: user.name || "",
        email: user.email || "",
      });
    }
  }, [user, resetProfile]);

  // Fetch billing/usage when relevant tabs become visible (including overview)
  useEffect(() => {
    if (!user) return;
    const loadBilling = async () => {
      setBillingLoading(true);
      setBillingError(null);
      try {
        const summary = await fetchBillingSummary();
        setBillingSummary(summary);
        setBudgetEnabledLocal(summary.budgetEnabled);
        setBudgetDollars(
          Math.max(10, Math.round((summary.overageBudgetCents || 1000) / 100))
        );
        // Removed selectedTier/selectedInterval state updates
      } catch {
        setBillingError("Failed to load billing summary");
      } finally {
        setBillingLoading(false);
      }
    };
    const loadUsage = async () => {
      setUsageLoading(true);
      setUsageError(null);
      try {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 29);
        const startIso = new Date(start.setHours(0, 0, 0, 0)).toISOString();
        const endIso = new Date(end.setHours(0, 0, 0, 0)).toISOString();
        setDateRange({ start: startIso, end: endIso });
        setSelectedQuickDays(30);
        const { data } = await apiClient.get(
          `/billing/reports?start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`
        );
        setUsageSeries(data as Array<{ date: string; reports: number }>);
      } catch {
        setUsageError("Failed to load usage");
      } finally {
        setUsageLoading(false);
      }
    };
    const isOverview = activeTab === "overview";
    const shouldLoadBilling =
      activeTab === "billing" || activeTab === "settings" || isOverview;
    const shouldLoadUsage = activeTab === "usage" || isOverview;
    if (shouldLoadBilling) void loadBilling();
    if (shouldLoadUsage) void loadUsage();
    if (activeTab === "settings") {
      setSessionsLoading(true);
      setSessionsError(null);
      fetchMySessions()
        .then(setSessions)
        .catch(() => setSessionsError("Failed to load sessions"))
        .finally(() => setSessionsLoading(false));
    }
    if (activeTab === "profile") {
      setTeamLoading(true);
      setTeamError(null);
      Promise.all([getTeamLimits(), getTeamMembers()])
        .then(([limits, members]) => {
          setSeatLimits(limits);
          setTeamMembers(members);
        })
        .catch(() => setTeamError("Failed to load team"))
        .finally(() => setTeamLoading(false));
    }
  }, [activeTab, user]);

  const refreshUsageSeries = async (
    mode: "reports" | "responses",
    range: { start: string; end: string }
  ) => {
    try {
      setUsageLoading(true);
      if (mode === "reports") {
        const { data } = await apiClient.get(
          `/billing/reports?start=${encodeURIComponent(range.start)}&end=${encodeURIComponent(range.end)}`
        );
        setUsageSeries(data as Array<{ date: string; reports: number }>);
      } else {
        const data = await fetchUsageSeries({
          start: range.start,
          end: range.end,
        });
        setUsageSeries(data);
      }
    } catch {
      setUsageError("Failed to load usage");
    } finally {
      setUsageLoading(false);
    }
  };

  const setQuickUsageRange = async (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    const startIso = new Date(start.setHours(0, 0, 0, 0)).toISOString();
    const endIso = new Date(end.setHours(0, 0, 0, 0)).toISOString();
    const newRange = { start: startIso, end: endIso };
    setDateRange(newRange);
    setSelectedQuickDays(days);
    await refreshUsageSeries(chartMode, newRange);
  };

  if (!isOpen) return null;

  const onUpdateProfile = async (data: ProfileFormData) => {
    setIsUpdatingProfile(true);
    setProfileError(null);

    try {
      const response = await apiClient.put("/users/me/profile", data);

      // Update the user context with new data
      updateUser(response.data.user);
    } catch (error) {
      const apiError = error as ApiError;
      setProfileError(
        apiError.response?.data?.error || "Failed to update profile"
      );
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Removed unused change password handler

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await logout();
      onClose(); // Close the modal after successful logout
    } catch (error) {
      console.error("Sign out failed:", error);
      // Even if logout fails, we should still close the modal
      // as the logout function in AuthContext handles clearing local state
      onClose();
    } finally {
      setIsSigningOut(false);
    }
  };

  const handleManageSubscription = () => {
    // If user has active subscription, redirect to customer portal
    if (user?.subscriptionStatus === "active") {
      // This would typically be a customer portal link from Stripe
      const billingUrl = process.env.VITE_STRIPE_BILLING_PORTAL_URL || "#";
      if (billingUrl !== "#") {
        window.open(billingUrl, "_blank");
      }
    } else {
      // Navigate to the payment page to choose a plan
      navigate("/payment");
    }
  };

  const handleDeleteCompany = async (companyId: string) => {
    try {
      await deleteCompany(companyId);
      setDeleteConfirm(null);
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (error) {
      console.error("Failed to delete company:", error);
    }
  };

  const handleStartEditCompany = (companyId: string) => {
    const company = companies.find((c) => c.id === companyId);
    setEditingCompany(companyId);
    setEditName(company?.name || "");
    setEditWebsite(company?.website || "");
    setEditIndustry(company?.industry || "");
  };

  const handleSaveEditCompany = async () => {
    if (!editingCompany) return;
    try {
      await updateCompany(editingCompany, {
        name: editName.trim(),
        website: editWebsite.trim(),
        industry: editIndustry.trim(),
      });
      setEditingCompany(null);
    } catch (error) {
      console.error("Failed to update company:", error);
    }
  };

  const handleCancelEditCompany = () => {
    setEditingCompany(null);
  };

  const handleSaveBudget = async () => {
    try {
      const dollars = Math.max(50, Math.round(budgetDollars));
      await updateBudget({
        enabled: budgetEnabledLocal,
        budgetCents: budgetEnabledLocal ? dollars * 100 : undefined,
      });
      const summary = await fetchBillingSummary();
      setBillingSummary(summary);
    } catch {
      setBillingError("Failed to update budget");
    }
  };

  const handleToggleUsagePricing = async (enabled: boolean) => {
    const previous = budgetEnabledLocal;
    setBudgetEnabledLocal(enabled);
    try {
      const dollars = Math.max(50, Math.round(proposedBudget || budgetDollars));
      await updateBudget({
        enabled,
        budgetCents: enabled ? dollars * 100 : undefined,
      });
    } catch {
      setBillingError("Failed to update budget");
      setBudgetEnabledLocal(previous);
    }
  };

  // Removed unused feedback submission handler

  // Note: plan saving handled inline via updatePlan; no separate handler required

  const handleSaveConfirmation = () => {
    setShowSaveConfirmation(false);
    setEditingCompany(null);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleCancelSaveConfirmation = () => {
    setShowSaveConfirmation(false);
  };

  // Removed inline report generation from profile modal (moved to header)

  const handleClose = () => {
    resetProfile({
      name: user?.name || "",
      email: user?.email || "",
    });
    setProfileError(null);
    // Removed password reset state
    setActiveTab("overview");
    onClose();
  };

  const isOAuthUser = user?.provider !== "credentials";
  // Compute a favicon URL from a company's website
  const getFaviconSrc = (website?: string | null): string | null => {
    if (!website) return null;
    try {
      const urlStr = website.startsWith("http")
        ? website
        : `https://${website}`;
      const hostname = new URL(urlStr).hostname;
      if (!hostname) return null;
      return `https://icons.duckduckgo.com/ip3/${hostname}.ico`;
    } catch {
      return null;
    }
  };

  const formatPlanTierLabel = (
    tier?: "STARTER" | "GROWTH" | "SCALE" | null
  ): string => {
    if (!tier) return "None";
    return tier.charAt(0) + tier.slice(1).toLowerCase();
  };

  const formatIntervalLabel = (
    interval?: "MONTHLY" | "ANNUAL" | null
  ): string => {
    if (!interval) return "—";
    return interval.charAt(0) + interval.slice(1).toLowerCase();
  };

  // Shared "puffed" pill styles (matches metrics/budget buttons)

  interface TabDef {
    id: string;
    label: string;
    icon: React.ComponentType<{ className?: string }> | null;
    isDivider?: boolean;
  }

  const tabs: Array<TabDef> = [
    { id: "overview", label: "Overview", icon: PieChart },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "divider-1", label: "", icon: null, isDivider: true },
    { id: "profile", label: "Team", icon: Users },
    { id: "companies", label: "Workspace", icon: Box },
    { id: "divider-2", label: "", icon: null, isDivider: true },
    { id: "usage", label: "Usage", icon: BarChart2 },
    { id: "billing", label: "Billing & Invoices", icon: CreditCard },
    { id: "divider-3", label: "", icon: null, isDivider: true },
    { id: "docs", label: "Docs", icon: BookOpen },
    { id: "contact", label: "Contact Us", icon: Mail },
  ];
  if (!isOAuthUser) {
    tabs.push({ id: "password", label: "Change Password", icon: Lock });
  }

  const renderBillingSection = (opts?: { showHeader?: boolean }) => (
    <div className="space-y-6">
      {opts?.showHeader !== false && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4">
            Billing & Subscription
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Manage your plan, billing period, and overage budget.
          </p>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {_billingLoading ? (
          <div className="py-6 flex items-center justify-center">
            <InlineSpinner size={16} />
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">Current Plan</h4>
                <div className="text-sm text-gray-600 flex items-center gap-2">
                  <span>
                    {formatPlanTierLabel(billingSummary?.planTier)} •{" "}
                    {formatIntervalLabel(billingSummary?.billingInterval)}
                  </span>
                  <span
                    className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full ${
                      user?.subscriptionStatus === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {user?.subscriptionStatus === "active"
                      ? "Active"
                      : "Inactive"}
                  </span>
                </div>
              </div>
            </div>
            <div className="space-y-6">
              <Button variant="pill" onClick={handleManageSubscription}>
                Manage Subscription
              </Button>
            </div>
            <div className="mt-6 rounded-lg bg-white p-4 shadow-inner border border-white/30">
              <div className="flex items-center justify-between">
                <div className="flex-1 pr-4">
                  {(() => {
                    const budgetEnabled =
                      billingSummary?.budgetEnabled ?? false;
                    const spent = Math.round(
                      (billingSummary?.overageAmountCents ?? 0) / 100
                    );
                    const limit = budgetEnabled
                      ? Math.round(
                          (billingSummary?.overageBudgetCents ?? 0) / 100
                        )
                      : 0;
                    const pct =
                      limit > 0
                        ? Math.min(100, Math.round((spent / limit) * 100))
                        : 0;
                    return (
                      <>
                        <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full bg-black"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </div>
                <div className="text-sm font-semibold">
                  {(() => {
                    const budgetEnabled =
                      billingSummary?.budgetEnabled ?? false;
                    const spent = Math.round(
                      (billingSummary?.overageAmountCents ?? 0) / 100
                    );
                    const limit = budgetEnabled
                      ? Math.round(
                          (billingSummary?.overageBudgetCents ?? 0) / 100
                        )
                      : 0;
                    return (
                      <span>
                        <span className="text-gray-900">${spent}</span>
                        <span className="text-gray-400"> / ${limit}</span>
                      </span>
                    );
                  })()}
                </div>
              </div>
              <p className="text-sm text-gray-600 mt-2">
                Usage-Based Spending this Month
              </p>
              {!isEditingBudget ? (
                <div className="mt-3">
                  <Button
                    variant="pill"
                    onClick={() => {
                      const current = Math.max(
                        50,
                        Math.round(
                          (billingSummary?.overageBudgetCents ?? 0) / 100
                        ) || 50
                      );
                      setProposedBudget(current);
                      setCustomBudgetInput("");
                      setBudgetErrorLocal(null);
                      setIsEditingBudget(true);
                    }}
                  >
                    Edit limit
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 mt-3">
                  <div className="grid grid-cols-5 gap-2">
                    {[50, 100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setProposedBudget(amt);
                          setCustomBudgetInput("");
                          setBudgetErrorLocal(null);
                        }}
                        className={`px-3 py-2 rounded-lg text-sm transition-colors select-none touch-manipulation ${
                          proposedBudget === amt
                            ? "bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900"
                            : "bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-700"
                        }`}
                      >
                        ${amt}
                      </button>
                    ))}
                    <div
                      className={`px-2 py-2 rounded-lg text-sm flex items-center transition-colors select-none touch-manipulation ${
                        customBudgetInput.trim() !== "" &&
                        /^\d+$/.test(customBudgetInput) &&
                        Number(customBudgetInput) >= 50
                          ? "bg-white/60 backdrop-blur-sm border border-white/30 shadow-inner text-gray-900"
                          : "bg-white/80 backdrop-blur-sm border border-white/20 shadow-md text-gray-700"
                      }`}
                    >
                      <span className="mr-1">$</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={customBudgetInput}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setCustomBudgetInput(raw);
                          if (raw.trim() === "") {
                            setBudgetErrorLocal(null);
                            return;
                          }
                          if (!/^\d+$/.test(raw)) {
                            setBudgetErrorLocal("Whole dollars only");
                            return;
                          }
                          const num = parseInt(raw, 10);
                          if (num <= 0) {
                            setBudgetErrorLocal("Must be > 0");
                            return;
                          }
                          if (num < 10) {
                            setBudgetErrorLocal("Minimum is $10");
                            return;
                          }
                          setBudgetErrorLocal(null);
                          setProposedBudget(num);
                        }}
                        className="w-20 bg-transparent outline-none text-current placeholder:text-gray-400"
                        placeholder="Custom"
                      />
                    </div>
                  </div>
                  {budgetErrorLocal && (
                    <div className="text-xs text-red-600">
                      {budgetErrorLocal}
                    </div>
                  )}
                  <div className="flex items-center justify-start gap-3 mt-4 mb-1 pt-2 pb-1">
                    <Button
                      variant="pill"
                      className="w-28"
                      onClick={async () => {
                        if (proposedBudget < 10) {
                          setBudgetErrorLocal("Minimum is $10");
                          return;
                        }
                        setBudgetDollars(proposedBudget);
                        setBudgetEnabledLocal(true);
                        await handleSaveBudget();
                        const refreshed = await fetchBillingSummary();
                        setBillingSummary(refreshed);
                        setIsEditingBudget(false);
                      }}
                      disabled={!!budgetErrorLocal}
                    >
                      Save
                    </Button>
                    <Button
                      variant="pill"
                      className="w-28"
                      onClick={() => {
                        setIsEditingBudget(false);
                        setBudgetErrorLocal(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderUsageSection = (opts?: {
    showHeader?: boolean;
    title?: string;
  }) => (
    <div className="space-y-6">
      {opts?.showHeader !== false && (
        <div>
          <h3 className="text-base font-semibold text-gray-900 mb-4">Usage</h3>
          <p className="text-sm text-gray-600 mb-4">
            Toggle between reports and responses, and pick a date range.
          </p>
        </div>
      )}
      <div className="bg-white rounded-lg shadow-lg p-6">
        {_usageLoading ? (
          <div className="py-6 flex items-center justify-center">
            <InlineSpinner size={16} />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-gray-900">
                  {opts?.title ?? "Credits"}
                </h4>
                <p className="text-sm text-gray-600">
                  Reports left: {billingSummary?.reportsLeft ?? "—"} of{" "}
                  {billingSummary?.includedReportsLimit ?? "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={chartMode === "reports" ? "pillActive" : "pill"}
                  className="w-28"
                  onClick={async () => {
                    setChartMode("reports");
                    if (dateRange)
                      await refreshUsageSeries("reports", dateRange);
                  }}
                >
                  Reports
                </Button>
                <Button
                  variant={chartMode === "responses" ? "pillActive" : "pill"}
                  className="w-28"
                  onClick={async () => {
                    setChartMode("responses");
                    if (dateRange)
                      await refreshUsageSeries("responses", dateRange);
                  }}
                >
                  Responses
                </Button>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm mt-4">
              <span className="text-gray-600">Range:</span>
              <Button
                variant={selectedQuickDays === 1 ? "pillActive" : "pill"}
                className="w-16"
                onClick={() => void setQuickUsageRange(1)}
              >
                1d
              </Button>
              <Button
                variant={selectedQuickDays === 7 ? "pillActive" : "pill"}
                className="w-16"
                onClick={() => void setQuickUsageRange(7)}
              >
                7d
              </Button>
              <Button
                variant={selectedQuickDays === 30 ? "pillActive" : "pill"}
                className="w-16"
                onClick={() => void setQuickUsageRange(30)}
              >
                30d
              </Button>
            </div>
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart
                  data={chartData}
                  margin={{ top: 5, right: 15, bottom: 0, left: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e2e8f0"
                    strokeWidth={1}
                  />
                  <XAxis
                    dataKey="dateLabel"
                    axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                  />
                  <YAxis
                    domain={[0, "dataMax + 1"]}
                    allowDecimals={false}
                    axisLine={{ stroke: "#e2e8f0", strokeWidth: 1 }}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    width={28}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      fontSize: "12px",
                      boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                    }}
                    itemStyle={{ color: "#374151" }}
                    labelStyle={{ color: "#1f2937", fontWeight: "bold" }}
                    formatter={(value: number) => [
                      `${value} ${chartMode === "reports" ? "reports" : "responses"}`,
                      chartMode === "reports" ? "Reports" : "Responses",
                    ]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <defs>
                    <linearGradient id="usageArea" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#2563eb"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#2563eb"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={2}
                    fill="url(#usageArea)"
                    dot={false}
                    activeDot={{
                      r: 4,
                      stroke: "#2563eb",
                      strokeWidth: 2,
                      fill: "#ffffff",
                    }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6"
        onClick={handleClose}
      >
        <div
          className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden text-sm"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
              Profile Settings
            </h2>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className="text-gray-400 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row h-[calc(95vh-80px)] sm:h-[calc(90vh-120px)]">
            {/* Sidebar */}
            <div className="w-full sm:w-64 bg-gray-50 border-b sm:border-b-0 sm:border-r border-gray-200 p-3 sm:p-4 flex-shrink-0">
              <nav className="flex flex-row sm:flex-col space-x-2 sm:space-x-0 sm:space-y-2 overflow-x-auto sm:overflow-x-visible">
                {tabs.map((tab) => {
                  if (tab.isDivider) {
                    return (
                      <div
                        key={tab.id}
                        className="my-2 border-t border-gray-200"
                      />
                    );
                  }
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-shrink-0 sm:w-full flex items-center justify-center sm:justify-start px-3 sm:px-4 py-1.5 sm:py-2 text-left rounded-lg transition-colors focus:outline-none whitespace-nowrap sm:whitespace-normal min-w-[44px] sm:min-w-0 text-xs sm:text-sm ${
                        activeTab === tab.id
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-700"
                      }`}
                    >
                      {Icon && <Icon className="w-4 h-4 sm:mr-2" />}
                      <span className="hidden sm:inline text-sm">
                        {tab.label}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {activeTab === "overview" && (
                <div className="space-y-8">
                  {renderBillingSection({ showHeader: false })}
                  {renderUsageSection({
                    showHeader: false,
                    title: "Your Analytics",
                  })}
                </div>
              )}
              {activeTab === "profile" && (
                <div className="space-y-6">
                  {/* Team management */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900">Team</h3>
                        <p className="text-sm text-gray-600">
                          Manage your team seats and members
                        </p>
                      </div>
                      {seatLimits && (
                        <div className="text-sm text-gray-700">
                          Seats: {seatLimits.seatsUsed} / {seatLimits.seatLimit}
                        </div>
                      )}
                    </div>
                    {teamError ? (
                      <div className="text-sm text-red-600">{teamError}</div>
                    ) : (
                      <>
                        {/* Invite */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-2 mb-4">
                          <div className="flex-1">
                            <label className="block text-xs text-gray-600 mb-1">
                              Invite by email
                            </label>
                            <input
                              type="email"
                              value={inviteEmail}
                              onChange={(e) => setInviteEmail(e.target.value)}
                              placeholder="user@example.com"
                              className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                            />
                          </div>
                          <div>
                            <button
                              type="button"
                              className="px-3 py-2 rounded-lg text-sm bg-white/80 backdrop-blur-sm border border-white/20 shadow text-gray-700 active:shadow-inner cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={
                                !inviteEmail ||
                                (seatLimits
                                  ? seatLimits.seatsUsed >= seatLimits.seatLimit
                                  : false)
                              }
                              onClick={async () => {
                                const email = inviteEmail.trim().toLowerCase();
                                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                                  setTeamError(
                                    "Please enter a valid email address"
                                  );
                                  return;
                                }
                                try {
                                  const result = await inviteTeamMember(email);
                                  const [limits, members] = await Promise.all([
                                    getTeamLimits(),
                                    getTeamMembers(),
                                  ]);
                                  setSeatLimits(limits);
                                  setTeamMembers(members);
                                  setInviteEmail("");
                                  
                                  // Show email delivery status feedback
                                  if (result.emailSent) {
                                    setTeamError(null);
                                  } else if (result.emailError) {
                                    setTeamError(
                                      `Invite created but email failed to send: ${result.emailError}`
                                    );
                                  } else {
                                    setTeamError(
                                      "Invite created but email was not sent - please check your email configuration"
                                    );
                                  }
                                } catch (e) {
                                  const message =
                                    (e as { message?: string })?.message ||
                                    "Failed to invite member";
                                  setTeamError(message);
                                }
                              }}
                            >
                              Invite
                            </button>
                          </div>
                        </div>
                        {/* Members list (includes workspace creator at top) */}
                        <ul className="divide-y divide-gray-200">
                          {/* Owner row */}
                          <li className="py-3 flex items-center justify-between">
                            <div className="min-w-0 pr-3">
                              <div className="text-sm text-gray-900 font-medium">
                                {user?.name || user?.email || "Owner"}
                              </div>
                              {user?.email && (
                                <div className="text-xs text-gray-500">
                                  {user.email} • Owner
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                title="Edit profile"
                                onClick={() => setSelfEditing(true)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-medium focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-600 shadow active:shadow-inner cursor-pointer"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                type="button"
                                title="Sign out"
                                onClick={() => setShowLogoutConfirm(true)}
                                disabled={isSigningOut}
                                className="w-8 h-8 rounded-lg flex items-center justify-center font-medium focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-600 shadow active:shadow-inner disabled:opacity-50 cursor-pointer"
                              >
                                {isSigningOut ? (
                                  <InlineSpinner size={16} />
                                ) : (
                                  <LogOut size={16} />
                                )}
                              </button>
                            </div>
                          </li>
                          {selfEditing && (
                            <li className="py-3">
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void handleSubmitProfile(async (data) => {
                                    await onUpdateProfile(data);
                                    setSelfEditing(false);
                                  })(e);
                                }}
                                className="flex flex-col sm:flex-row gap-2"
                              >
                                <input
                                  type="text"
                                  placeholder="Account name"
                                  {...registerProfile("name")}
                                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                />
                                <input
                                  type="email"
                                  placeholder="Email address"
                                  {...registerProfile("email")}
                                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                />
                                <div className="flex items-center gap-2">
                                  <Button
                                    type="submit"
                                    variant="pill"
                                    className="w-20"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="pill"
                                    className="w-20"
                                    onClick={() => {
                                      resetProfile({
                                        name: user?.name || "",
                                        email: user?.email || "",
                                      });
                                      setSelfEditing(false);
                                    }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </form>
                            </li>
                          )}
                          {/* Members */}
                          {teamLoading && teamMembers.length === 0 ? (
                            <li className="py-3">
                              <InlineSpinner size={16} />
                            </li>
                          ) : teamMembers.length === 0 ? (
                            <li className="py-3 text-sm text-gray-600">
                              No additional members yet.
                            </li>
                          ) : (
                            teamMembers.map((m) => (
                              <li
                                key={m.id}
                                className="py-3 flex items-center justify-between"
                              >
                                <div className="min-w-0 pr-3">
                                  <div className="text-sm text-gray-900 font-medium">
                                    {m.member.name || m.member.email}
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {m.member.email} •{" "}
                                    {m.status === "INVITED"
                                      ? "Invited"
                                      : "Active"}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    title="Remove member"
                                    className="w-8 h-8 rounded-lg flex items-center justify-center font-medium focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-600 shadow active:shadow-inner cursor-pointer"
                                    onClick={async () => {
                                      try {
                                        await removeTeamMember(m.memberUserId);
                                        setTeamMembers((prev) =>
                                          prev.filter((x) => x.id !== m.id)
                                        );
                                        if (seatLimits) {
                                          setSeatLimits({
                                            ...seatLimits,
                                            seatsUsed: Math.max(
                                              0,
                                              seatLimits.seatsUsed - 1
                                            ),
                                          });
                                        }
                                      } catch {
                                        setTeamError("Failed to remove member");
                                      }
                                    }}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      </>
                    )}
                  </div>

                  {/* Delete Account section */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">
                      Delete Account
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Permanently delete your account and all associated data.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteConfirmText("");
                        setDeleteError(null);
                        setShowDeleteAccountConfirm(true);
                      }}
                      className="px-3 py-2 rounded-lg text-sm bg-red-600 text-white shadow active:shadow-inner"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              )}

              {activeTab === "companies" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="mb-4">
                      <h3 className="font-semibold text-gray-900">
                        Company Profiles
                      </h3>
                      <p className="text-sm text-gray-600">
                        Manage your workspace portfolio
                      </p>
                    </div>

                    <div className="space-y-4">
                      {companies.map((company) => (
                        <div
                          key={company.id}
                          className="bg-white rounded-lg shadow-lg p-4 space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="flex-shrink-0">
                                  {(() => {
                                    const src = getFaviconSrc(company.website);
                                    return src ? (
                                      <img
                                        src={src}
                                        alt=""
                                        className="w-8 h-8 rounded"
                                        onError={(e) => {
                                          (
                                            e.currentTarget as HTMLImageElement
                                          ).style.visibility = "hidden";
                                        }}
                                      />
                                    ) : (
                                      <Globe className="w-8 h-8 text-gray-400" />
                                    );
                                  })()}
                                </div>
                                <div className="min-w-0 flex-1">
                                  {editingCompany === company.id ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pb-1 pt-2">
                                      <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) =>
                                          setEditName(e.target.value)
                                        }
                                        className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                        placeholder="Company name"
                                      />
                                      <input
                                        type="text"
                                        value={editWebsite}
                                        onChange={(e) =>
                                          setEditWebsite(e.target.value)
                                        }
                                        className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                        placeholder="https://company.com"
                                      />
                                      <InlineIndustryAutocomplete
                                        value={editIndustry}
                                        onChange={setEditIndustry}
                                        placeholder="Industry (e.g., SaaS, Ecommerce)"
                                      />
                                    </div>
                                  ) : (
                                    <div className="py-2">
                                      <h4 className="font-semibold text-gray-900 truncate">
                                        {company.name}
                                      </h4>
                                      <div className="space-y-1">
                                        {company.website && (
                                          <a
                                            href={
                                              company.website.startsWith("http")
                                                ? company.website
                                                : `https://${company.website}`
                                            }
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center truncate"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <span className="truncate">
                                              {company.website.replace(
                                                /^https?:\/\//,
                                                ""
                                              )}
                                            </span>
                                          </a>
                                        )}
                                        {company.industry && (
                                          <span className="text-xs text-gray-500">
                                            {company.industry}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex items-center gap-2 ml-2">
                              {editingCompany !== company.id && (
                                <button
                                  onClick={() =>
                                    handleStartEditCompany(company.id)
                                  }
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                                  title="Edit company"
                                  style={{
                                    WebkitTapHighlightColor: "transparent",
                                    WebkitUserSelect: "none",
                                    userSelect: "none",
                                  }}
                                >
                                  <Edit2 size={16} />
                                </button>
                              )}
                              {editingCompany !== company.id && (
                                <button
                                  onClick={() => setDeleteConfirm(company.id)}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center font-medium transition-colors focus:outline-none select-none touch-manipulation bg-white/80 backdrop-blur-sm border border-white/20 text-gray-500 hover:text-gray-700 hover:bg-white/85 hover:shadow-md active:bg-white/60 active:shadow-inner"
                                  title="Delete company"
                                  style={{
                                    WebkitTapHighlightColor: "transparent",
                                    WebkitUserSelect: "none",
                                    userSelect: "none",
                                  }}
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          </div>

                          {editingCompany === company.id && (
                            <div className="flex items-center justify-start gap-3 mt-3">
                              <Button
                                variant="pill"
                                className="w-24"
                                onClick={handleSaveEditCompany}
                                disabled={
                                  !editName.trim() || !editWebsite.trim()
                                }
                              >
                                Save
                              </Button>
                              <Button
                                variant="pill"
                                className="w-24"
                                onClick={handleCancelEditCompany}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}

                          {deleteConfirm === company.id && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                              <p className="text-sm text-red-800 mb-3">
                                Are you sure you want to delete "{company.name}
                                "? This action cannot be undone.
                              </p>
                              <div className="flex space-x-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleDeleteCompany(company.id)
                                  }
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Yes, Delete
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setDeleteConfirm(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="space-y-6">
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Usage-Based Pricing
                        </h3>
                        <p className="text-sm text-gray-600">
                          Enable usage-based pricing to pay for extra reports
                          beyond your plan's included usage
                        </p>
                      </div>
                      <label className="inline-flex items-center cursor-pointer select-none touch-manipulation">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={budgetEnabledLocal}
                          onChange={(e) =>
                            void handleToggleUsagePricing(e.target.checked)
                          }
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:h-5 after:w-5 after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:transition-all peer-checked:bg-gray-700 relative"></div>
                      </label>
                    </div>

                    {budgetEnabledLocal && (
                      <div className="mt-6 space-y-3">
                        <h4 className="font-semibold text-gray-900">
                          Set Monthly Spend Limit
                        </h4>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-600">$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={String(proposedBudget)}
                            onChange={(e) => {
                              const raw = e.target.value.replace(/\D/g, "");
                              if (raw === "") {
                                setProposedBudget(0);
                                return;
                              }
                              setProposedBudget(Number(raw));
                            }}
                            onBlur={() => {
                              if (proposedBudget < 10) setProposedBudget(10);
                            }}
                            className="w-28 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                            placeholder="10"
                          />
                          <button
                            type="button"
                            className="px-3 py-2 rounded-lg text-sm bg-white/80 backdrop-blur-sm border border-white/20 shadow text-gray-700 active:shadow-inner"
                            onClick={async () => {
                              const dollars = Math.max(
                                10,
                                Math.round(proposedBudget)
                              );
                              setBudgetDollars(dollars);
                              setBudgetEnabledLocal(true);
                              await updateBudget({
                                enabled: true,
                                budgetCents: dollars * 100,
                              });
                              const refreshed = await fetchBillingSummary();
                              setBillingSummary(refreshed);
                              setBudgetEnabledLocal(refreshed.budgetEnabled);
                              if (refreshed.overageBudgetCents != null) {
                                setBudgetDollars(
                                  Math.round(refreshed.overageBudgetCents / 100)
                                );
                              }
                            }}
                          >
                            Save Limits
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">Minimum $10</p>
                      </div>
                    )}
                  </div>

                  {/* Active Sessions */}
                  <div className="bg-white rounded-lg shadow-lg p-6">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          Active Sessions
                        </h3>
                        <p className="text-sm text-gray-600">
                          Devices currently signed in to your account
                        </p>
                      </div>
                    </div>
                    {sessionsLoading ? (
                      <div className="py-3">
                        <InlineSpinner size={16} />
                      </div>
                    ) : sessionsError ? (
                      <div className="text-sm text-red-600">
                        {sessionsError}
                      </div>
                    ) : sessions.length === 0 ? (
                      <div className="text-sm text-gray-600">
                        No active sessions.
                      </div>
                    ) : (
                      <ul className="divide-y divide-gray-200">
                        {sessions.map((s) => {
                          const deviceIcon = (() => {
                            switch (s.deviceType) {
                              case "MOBILE":
                                return (
                                  <Smartphone className="w-4 h-4 text-gray-600" />
                                );
                              case "DESKTOP":
                                return (
                                  <Monitor className="w-4 h-4 text-gray-600" />
                                );
                              case "WEB":
                                return (
                                  <Globe className="w-4 h-4 text-gray-600" />
                                );
                              default:
                                return (
                                  <Box className="w-4 h-4 text-gray-600" />
                                );
                            }
                          })();
                          const createdAgo = (() => {
                            const created = new Date(s.createdAt);
                            const diffMs = Date.now() - created.getTime();
                            const minutes = Math.floor(diffMs / 60000);
                            if (minutes < 60) return `${minutes}m ago`;
                            const hours = Math.floor(minutes / 60);
                            if (hours < 24) return `${hours}h ago`;
                            const days = Math.floor(hours / 24);
                            if (days < 30) return `${days}d ago`;
                            const months = Math.floor(days / 30);
                            return `${months}mo ago`;
                          })();
                          const ua = s.userAgent || "";
                          const uaShort =
                            ua.length > 64 ? `${ua.slice(0, 64)}…` : ua;
                          return (
                            <li
                              key={s.id}
                              className="py-3 flex items-center justify-between"
                            >
                              <div className="min-w-0 pr-3">
                                <div className="flex items-center gap-2 text-sm text-gray-900">
                                  {deviceIcon}
                                  <span className="font-medium">
                                    {s.deviceType}
                                  </span>
                                  <span className="text-gray-500">•</span>
                                  <span className="text-gray-600">
                                    Created {createdAgo}
                                  </span>
                                </div>
                                <div className="text-xs text-gray-500 truncate">
                                  {uaShort}
                                  {s.ipAddress ? ` • ${s.ipAddress}` : ""}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      await revokeMySession(s.id);
                                      setSessions((prev) =>
                                        prev.filter((x) => x.id !== s.id)
                                      );
                                    } catch {
                                      setSessionsError(
                                        "Failed to revoke session"
                                      );
                                    }
                                  }}
                                  className="px-3 py-1.5 rounded-lg text-xs bg-white/80 backdrop-blur-sm border border-white/20 text-gray-700 shadow hover:bg-white/85 active:shadow-inner"
                                >
                                  Revoke
                                </button>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "billing" && (
                <div className="space-y-8">{renderBillingSection()}</div>
              )}
              {activeTab === "usage" && (
                <div className="space-y-8">{renderUsageSection()}</div>
              )}
            </div>
          </div>
        </div>
        {/* Full-screen company edit overlay removed; editing is inline */}

        {/* Save Confirmation Dialog */}
        {showSaveConfirmation && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]">
            <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl p-6">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0">
                  <AlertTriangle className="h-6 w-6 text-yellow-500" />
                </div>
                <div className="ml-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Changes Saved Successfully
                  </h3>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-sm text-gray-600">
                  Your company profile has been updated. These changes will be
                  reflected in the next report generated for this company.
                </p>
              </div>

              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  onClick={handleCancelSaveConfirmation}
                  className="text-gray-700"
                >
                  Continue Editing
                </Button>
                <Button
                  onClick={handleSaveConfirmation}
                  className="bg-black text-white"
                >
                  Got It
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Logout Confirmation Dialog */}
        {showLogoutConfirm && (
          <div
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirm Sign Out
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to sign out from this device?
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowLogoutConfirm(false)}
                  className="text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    setShowLogoutConfirm(false);
                    await handleSignOut();
                  }}
                  className="bg-black text-white"
                >
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Account Confirmation Dialog */}
        {showDeleteAccountConfirm && (
          <div
            className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3">
                <h3 className="text-lg font-semibold text-gray-900">
                  Delete Account
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Are you sure you want to delete your account? This action is
                  irreversible.
                </p>
              </div>
              <div className="space-y-2">
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type 'Delete' to confirm"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                />
                {deleteError && (
                  <div className="text-xs text-red-600">{deleteError}</div>
                )}
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteAccountConfirm(false)}
                  className="text-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  disabled={deleteConfirmText !== "Delete" || deletingAccount}
                  onClick={async () => {
                    if (deleteConfirmText !== "Delete") return;
                    setDeleteError(null);
                    setDeletingAccount(true);
                    try {
                      await apiClient.delete("/users/me/delete");
                      await logout();
                      onClose();
                    } catch {
                      setDeleteError("Failed to delete account");
                    } finally {
                      setDeletingAccount(false);
                    }
                  }}
                  className="bg-red-600 text-white"
                >
                  {deletingAccount ? "Deleting..." : "Delete"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ProfileModal;
