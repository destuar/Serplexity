/**
 * @file EmailNotificationsModal.tsx
 * @description Modal component for managing email notification settings.
 * Allows users to configure rules for receiving email alerts based on metric changes.
 *
 * @dependencies
 * - react: For component state and lifecycle management
 * - lucide-react: For icons and UI elements
 * - ../../contexts/AuthContext: For user authentication
 * - ../../contexts/CompanyContext: For company selection
 * - ../../services/emailNotificationService: For API calls
 *
 * @exports
 * - EmailNotificationsModal: Main modal component
 */

import {
  Bell,
  Check,
  ChevronDown,
  Mail,
  Plus,
  Save,
  Send,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { useCompany } from "../../contexts/CompanyContext";
import {
  createNotificationRules,
  deleteNotificationRule,
  getNotificationRules,
  getNotificationStats,
  sendTestNotification,
} from "../../services/emailNotificationService";
import { Button } from "../ui/Button";
import { InlineSpinner } from "../ui/InlineSpinner";

interface EmailNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface NotificationRule {
  id?: string;
  companyId?: string | null;
  metric: "RANKING" | "SOV_CHANGE" | "INCLUSION_RATE" | "SENTIMENT_SCORE";
  thresholdType: "ABSOLUTE" | "PERCENT";
  thresholdValue: number;
  direction: "UP" | "DOWN" | "BETTER" | "WORSE" | "ANY";
  frequency: "INSTANT" | "DAILY_DIGEST";
  emails: string[];
  active: boolean;
}

const METRIC_LABELS = {
  RANKING: "Competitor Ranking",
  SOV_CHANGE: "Share of Voice",
  INCLUSION_RATE: "Inclusion Rate",
  SENTIMENT_SCORE: "Sentiment Score",
};

const DIRECTION_LABELS = {
  UP: "Increases",
  DOWN: "Decreases",
  BETTER: "Improves",
  WORSE: "Declines",
  ANY: "Changes",
};

const FREQUENCY_LABELS = {
  INSTANT: "Instant alerts",
  DAILY_DIGEST: "Daily digest",
};

const EmailNotificationsModal: React.FC<EmailNotificationsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { companies } = useCompany();

  // State management
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testEmails, setTestEmails] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [selectedCompanyFilter, setSelectedCompanyFilter] =
    useState<string>("all");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalRules: number;
    activeRules: number;
    notificationsSent24h: number;
    lastNotificationSent: string | null;
  } | null>(null);

  // Define loadRules function before using it in useEffect
  const loadRules = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const companyId =
        selectedCompanyFilter === "all" ? undefined : selectedCompanyFilter;
      const response = await getNotificationRules(companyId);
      setRules(response.rules || []);
    } catch (_err) {
      setError("Failed to load notification rules");
      console.error("Error loading notification rules:", _err);
    } finally {
      setLoading(false);
    }
  }, [user, selectedCompanyFilter]);

  // Load notification rules when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadRules();
    }
  }, [isOpen, user, selectedCompanyFilter, loadRules]);

  // Load top-line notification stats to provide quick context, mirroring Profile modal overview
  useEffect(() => {
    const loadStats = async () => {
      if (!isOpen || !user) return;
      setStatsLoading(true);
      try {
        const companyId =
          selectedCompanyFilter === "all" ? undefined : selectedCompanyFilter;
        const s = await getNotificationStats(companyId);
        setStats(s);
      } catch (_err) {
        // Non-blocking; silently ignore in UI to avoid noise
      } finally {
        setStatsLoading(false);
      }
    };
    void loadStats();
  }, [isOpen, user, selectedCompanyFilter]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setSuccessMessage(null);
      setTestSent(false);
      setTestEmails("");
    }
  }, [isOpen]);

  const addNewRule = () => {
    const newRule: NotificationRule = {
      companyId: selectedCompanyFilter === "all" ? null : selectedCompanyFilter,
      metric: "SOV_CHANGE",
      thresholdType: "PERCENT",
      thresholdValue: 10,
      direction: "UP",
      frequency: "INSTANT",
      emails: [],
      active: true,
    };
    setRules([...rules, newRule]);
  };

  const updateRule = (index: number, updates: Partial<NotificationRule>) => {
    const updatedRules = [...rules];
    updatedRules[index] = { ...updatedRules[index], ...updates };
    setRules(updatedRules);
  };

  const removeRule = async (index: number) => {
    const rule = rules[index];

    if (rule.id) {
      // Delete from server if it has an ID
      try {
        await deleteNotificationRule(rule.id);
        setSuccessMessage("Notification rule deleted successfully");
      } catch {
        setError("Failed to delete notification rule");
        return;
      }
    }

    // Remove from local state
    const updatedRules = rules.filter((_, i) => i !== index);
    setRules(updatedRules);
  };

  const saveRules = async () => {
    if (!user) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Validate rules before saving
      const validationErrors = validateRules(rules);
      if (validationErrors.length > 0) {
        setError(validationErrors.join("; "));
        return;
      }

      await createNotificationRules(rules);
      setSuccessMessage("Notification rules saved successfully");
      await loadRules(); // Reload to get updated IDs
    } catch (err) {
      setError("Failed to save notification rules");
      console.error("Error saving notification rules:", err);
    } finally {
      setSaving(false);
    }
  };

  const validateRules = (rulesToValidate: NotificationRule[]): string[] => {
    const errors: string[] = [];

    for (const rule of rulesToValidate) {
      if (rule.emails.length === 0) {
        errors.push("Each rule must have at least one email address");
      }

      if (rule.thresholdValue <= 0) {
        errors.push("Threshold values must be positive");
      }

      if (
        rule.metric === "RANKING" &&
        !["BETTER", "WORSE", "ANY"].includes(rule.direction)
      ) {
        errors.push("Ranking metrics must use BETTER, WORSE, or ANY direction");
      }

      if (
        rule.metric !== "RANKING" &&
        ["BETTER", "WORSE"].includes(rule.direction)
      ) {
        errors.push("Only ranking metrics can use BETTER/WORSE direction");
      }
    }

    return errors;
  };

  const sendTest = async () => {
    if (!testEmails.trim()) {
      setError("Please enter at least one email address for testing");
      return;
    }

    setTestSending(true);
    setError(null);

    try {
      const emails = testEmails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      await sendTestNotification(emails);
      setTestSent(true);
      setSuccessMessage("Test notification sent successfully");
    } catch (err) {
      setError("Failed to send test notification");
      console.error("Error sending test notification:", err);
    } finally {
      setTestSending(false);
    }
  };

  const handleEmailsChange = (index: number, emailsText: string) => {
    const emails = emailsText
      .split(",")
      .map((email) => email.trim())
      .filter((email) => email.length > 0);
    updateRule(index, { emails });
  };

  if (!isOpen) return null;

  const handleOverlayClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 sm:p-6"
      onClick={handleOverlayClick}
    >
      <div
        className="bg-white rounded-xl sm:rounded-2xl w-full max-w-4xl shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Bell className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                Email Notifications
              </h2>
              <p className="text-xs sm:text-sm text-gray-600">
                Configure alerts for metric changes
              </p>
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[calc(95vh-140px)] sm:max-h-[calc(90vh-140px)] space-y-6">
          {/* Quick Stats (non-blocking) */}
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm p-3">
                <div className="text-[11px] text-gray-500">Total Rules</div>
                <div className="text-base font-semibold text-gray-900">
                  {statsLoading ? "—" : (stats?.totalRules ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm p-3">
                <div className="text-[11px] text-gray-500">Active Rules</div>
                <div className="text-base font-semibold text-gray-900">
                  {statsLoading ? "—" : (stats?.activeRules ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm p-3">
                <div className="text-[11px] text-gray-500">Sent (24h)</div>
                <div className="text-base font-semibold text-gray-900">
                  {statsLoading ? "—" : (stats?.notificationsSent24h ?? 0)}
                </div>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white/80 backdrop-blur-sm p-3">
                <div className="text-[11px] text-gray-500">Last Sent</div>
                <div className="text-base font-semibold text-gray-900 truncate">
                  {statsLoading
                    ? "—"
                    : stats?.lastNotificationSent
                      ? new Date(stats.lastNotificationSent).toLocaleString()
                      : "—"}
                </div>
              </div>
            </div>
          </div>
          {/* Company Filter */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Monitor Companies
            </label>
            <div className="relative">
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none appearance-none"
              >
                <option value="all">All Companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          {/* Test Notifications Section */}
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Test Notifications
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Email Addresses (comma-separated)
                </label>
                <input
                  type="text"
                  value={testEmails}
                  onChange={(e) => setTestEmails(e.target.value)}
                  placeholder="test@example.com, admin@company.com"
                  className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                />
              </div>
              <Button
                onClick={sendTest}
                disabled={testSending || !testEmails.trim()}
                variant="pill"
              >
                {testSending ? (
                  <>
                    <InlineSpinner className="mr-2" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Test Notification
                  </>
                )}
              </Button>
              {testSent && (
                <div className="flex items-center gap-2 text-green-600 text-sm">
                  <Check className="w-4 h-4" />
                  Test notification sent successfully
                </div>
              )}
            </div>
          </div>

          {/* Notification Rules */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Notification Rules
              </h3>
              <Button onClick={addNewRule} variant="pill">
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <InlineSpinner className="mr-3" />
                Loading notification rules...
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>No notification rules configured yet</p>
                <p className="text-sm">
                  Add a rule to get started with email alerts
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg shadow-lg p-4 space-y-4"
                  >
                    {/* Rule Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Metric Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Metric
                        </label>
                        <select
                          value={rule.metric}
                          onChange={(e) =>
                            updateRule(index, {
                              metric: e.target
                                .value as NotificationRule["metric"],
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                        >
                          {Object.entries(METRIC_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {/* Direction */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          When it
                        </label>
                        <select
                          value={rule.direction}
                          onChange={(e) =>
                            updateRule(index, {
                              direction: e.target
                                .value as NotificationRule["direction"],
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                        >
                          {Object.entries(DIRECTION_LABELS)
                            .filter(([value]) => {
                              // Filter directions based on metric type
                              if (rule.metric === "RANKING") {
                                return ["BETTER", "WORSE", "ANY"].includes(
                                  value
                                );
                              }
                              return ["UP", "DOWN", "ANY"].includes(value);
                            })
                            .map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                        </select>
                      </div>

                      {/* Threshold */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Threshold
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={rule.thresholdValue}
                            onChange={(e) =>
                              updateRule(index, {
                                thresholdValue: parseFloat(e.target.value) || 0,
                              })
                            }
                            min="0"
                            step="0.1"
                            className="flex-1 px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                          />
                          <select
                            value={rule.thresholdType}
                            onChange={(e) =>
                              updateRule(index, {
                                thresholdType: e.target.value as
                                  | "ABSOLUTE"
                                  | "PERCENT",
                              })
                            }
                            className="px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                          >
                            <option value="PERCENT">%</option>
                            <option value="ABSOLUTE">Abs</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Frequency and Email Settings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Frequency */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Frequency
                        </label>
                        <select
                          value={rule.frequency}
                          onChange={(e) =>
                            updateRule(index, {
                              frequency: e.target.value as
                                | "INSTANT"
                                | "DAILY_DIGEST",
                            })
                          }
                          className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                        >
                          {Object.entries(FREQUENCY_LABELS).map(
                            ([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            )
                          )}
                        </select>
                      </div>

                      {/* Active Toggle */}
                      <div>
                        <label className="flex items-center space-x-2 pt-6">
                          <input
                            type="checkbox"
                            checked={rule.active}
                            onChange={(e) =>
                              updateRule(index, { active: e.target.checked })
                            }
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm font-medium text-gray-700">
                            Rule is active
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* Email Addresses */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Addresses (comma-separated)
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                          <input
                            type="text"
                            value={rule.emails.join(", ")}
                            onChange={(e) =>
                              handleEmailsChange(index, e.target.value)
                            }
                            placeholder="admin@company.com, team@company.com"
                            className="w-full pl-10 pr-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                          />
                        </div>
                        <button
                          onClick={() => removeRule(index)}
                          className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          aria-label="Delete rule"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Error and Success Messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {successMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {rules.length} rule{rules.length !== 1 ? "s" : ""} configured
          </div>
          <div className="flex gap-3">
            <Button variant="pill" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={saveRules}
              disabled={saving || rules.length === 0}
              variant="pill"
            >
              {saving ? (
                <>
                  <InlineSpinner className="mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Rules
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailNotificationsModal;
