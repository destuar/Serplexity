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
  Edit2,
  Plus,
  Send,
  Settings,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import {
  NotificationRule as ServiceNotificationRule,
  createNotificationRules,
  deleteNotificationRule,
  getNotificationRules,
  getNotificationStats,
  sendTestNotification,
} from "../../services/emailNotificationService";
import {
  TeamMemberDto,
  getTeamMembers,
} from "../../services/teamService";
import { Button } from "../ui/Button";
import { InlineSpinner } from "../ui/InlineSpinner";

interface EmailNotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Extend the service interface to include userIds for frontend state management
interface NotificationRule extends ServiceNotificationRule {
  userIds: string[]; // Frontend-only field for managing user selection
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

  // State management
  const [activeTab, setActiveTab] = useState("rules");
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [testEmails, setTestEmails] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [stats, setStats] = useState<{
    totalRules: number;
    activeRules: number;
    notificationsSent24h: number;
    lastNotificationSent: string | null;
  } | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMemberDto[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [editingRuleIndex, setEditingRuleIndex] = useState<number | null>(null);
  const [savingRule, setSavingRule] = useState<number | null>(null);

  // Helper function to convert emails back to userIds when loading from backend
  const convertEmailsToUserIds = useCallback((emails: string[]): string[] => {
    const userIds: string[] = [];
    
    // Check if current user's email is in the list
    if (user?.email && emails.includes(user.email)) {
      userIds.push(user.id);
    }
    
    // Check team members
    teamMembers.forEach(member => {
      if (member.member.email && emails.includes(member.member.email)) {
        userIds.push(member.memberUserId);
      }
    });
    
    return userIds;
  }, [user, teamMembers]);

  // Define loadRules function before using it in useEffect
  const loadRules = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const response = await getNotificationRules();
      const rulesWithUserIds = (response.rules || []).map(rule => ({
        ...rule,
        userIds: convertEmailsToUserIds(rule.emails) // Convert emails back to userIds for frontend
      }));
      setRules(rulesWithUserIds);
    } catch (_err) {
      setError("Failed to load notification rules");
      console.error("Error loading notification rules:", _err);
    } finally {
      setLoading(false);
    }
  }, [user, convertEmailsToUserIds]);

  // Load notification rules when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadRules();
      // Load team members
      const loadTeamMembers = async () => {
        setTeamLoading(true);
        try {
          const members = await getTeamMembers();
          setTeamMembers(members);
        } catch (error) {
          console.error("Failed to load team members:", error);
        } finally {
          setTeamLoading(false);
        }
      };
      loadTeamMembers();
    }
  }, [isOpen, user, loadRules]);

  // Load top-line notification stats to provide quick context, mirroring Profile modal overview
  useEffect(() => {
    const loadStats = async () => {
      if (!isOpen || !user) return;
      setStatsLoading(true);
      try {
        const s = await getNotificationStats();
        setStats(s);
      } catch {
        // Non-blocking; silently ignore in UI to avoid noise
      } finally {
        setStatsLoading(false);
      }
    };
    void loadStats();
  }, [isOpen, user]);

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
      companyId: null,
      metric: "SOV_CHANGE",
      thresholdType: "PERCENT",
      thresholdValue: 10,
      direction: "UP",
      frequency: "INSTANT",
      emails: [],
      userIds: [],
      active: true, // Always create active rules since we removed the checkbox
    };
    const newIndex = rules.length;
    setRules([...rules, newRule]);
    setEditingRuleIndex(newIndex);
  };

  const updateRule = (index: number, updates: Partial<NotificationRule>) => {
    const updatedRules = [...rules];
    updatedRules[index] = { ...updatedRules[index], ...updates };
    setRules(updatedRules);
  };

  const saveRule = async (index: number) => {
    const rule = rules[index];
    
    // Validate the rule
    const validationErrors = validateRules([rule]);
    if (validationErrors.length > 0) {
      setError(validationErrors.join("; "));
      return;
    }

    setSavingRule(index);
    setError(null);

    try {
      // Convert userIds to emails for backend
      const emails: string[] = [];
      
      // Add current user email if selected
      if (rule.userIds.includes(user?.id || "") && user?.email) {
        emails.push(user.email);
      }
      
      // Add team member emails
      const selectedMembers = teamMembers.filter(m => 
        rule.userIds.includes(m.memberUserId) && m.status === "ACTIVE"
      );
      selectedMembers.forEach(member => {
        if (member.member.email) {
          emails.push(member.member.email);
        }
      });
      
      // Create rule object compatible with backend (without userIds)
      const { userIds: _userIds, ...ruleForBackend } = rule;
      const ruleWithEmails: ServiceNotificationRule = {
        ...ruleForBackend,
        emails
      };

      await createNotificationRules([ruleWithEmails]);
      await loadRules(); // Reload to get updated IDs
      setEditingRuleIndex(null);
    } catch (err) {
      setError("Failed to save notification rule");
      console.error("Error saving notification rule:", err);
    } finally {
      setSavingRule(null);
    }
  };

  const cancelEditRule = (index: number) => {
    const rule = rules[index];
    if (!rule.id) {
      // If it's a new rule without an ID, remove it
      const updatedRules = rules.filter((_, i) => i !== index);
      setRules(updatedRules);
    }
    setEditingRuleIndex(null);
    setError(null);
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
    
    // Reset editing state if we were editing this rule
    if (editingRuleIndex === index) {
      setEditingRuleIndex(null);
    } else if (editingRuleIndex !== null && editingRuleIndex > index) {
      setEditingRuleIndex(editingRuleIndex - 1);
    }
  };

  const formatRuleDisplay = (rule: NotificationRule): string => {
    const metric = METRIC_LABELS[rule.metric];
    const direction = DIRECTION_LABELS[rule.direction].toLowerCase();
    const threshold = `${rule.thresholdValue}${rule.thresholdType === "PERCENT" ? "%" : ""}`;
    const frequency = FREQUENCY_LABELS[rule.frequency].toLowerCase();
    
    // Get selected user names
    const selectedUsers: string[] = [];
    if (rule.userIds.includes(user?.id || "") && user?.name) {
      selectedUsers.push(user.name);
    }
    const selectedMembers = teamMembers.filter(m => 
      rule.userIds.includes(m.memberUserId) && m.status === "ACTIVE"
    );
    selectedMembers.forEach(member => {
      if (member.member.name) {
        selectedUsers.push(member.member.name);
      }
    });
    
    const usersText = selectedUsers.length > 0 
      ? ` → ${selectedUsers.join(", ")}` 
      : " → No users selected";
    
    return `${metric} ${direction} by ${threshold} (${frequency})${usersText}`;
  };

  const validateRules = (rulesToValidate: NotificationRule[]): string[] => {
    const errors: string[] = [];

    for (const rule of rulesToValidate) {
      if (rule.userIds.length === 0) {
        errors.push("Each rule must have at least one team member selected");
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
    setSuccessMessage(null);

    try {
      const emails = testEmails
        .split(",")
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      // Validate email format
      for (const email of emails) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError(`Invalid email address: ${email}`);
          setTestSending(false);
          return;
        }
      }

      const result = await sendTestNotification(emails);
      
      if (result.success) {
        setTestSent(true);
        setSuccessMessage(result.message + (result.details ? ` - ${result.details}` : ""));
        setTestEmails(""); // Clear the input after successful send
      } else {
        setError("Test notification failed to send");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test notification");
      console.error("Error sending test notification:", err);
    } finally {
      setTestSending(false);
    }
  };


  const tabs = [
    { id: "rules", label: "Notification Rules", icon: Settings },
    { id: "test", label: "Test Notifications", icon: Send },
  ];

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    // Clear messages when switching tabs
    setError(null);
    setSuccessMessage(null);
    setTestSent(false);
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
        className="bg-white rounded-xl sm:rounded-2xl max-w-4xl w-full shadow-2xl max-h-[95vh] sm:max-h-[90vh] overflow-hidden text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Notifications
          </h2>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
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
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex-shrink-0 sm:w-full flex items-center justify-center sm:justify-start px-3 sm:px-4 py-1.5 sm:py-2 text-left rounded-lg transition-colors focus:outline-none whitespace-nowrap sm:whitespace-normal min-w-[44px] sm:min-w-0 text-xs sm:text-sm ${
                      activeTab === tab.id
                        ? "bg-gray-100 text-gray-900"
                        : "text-gray-700"
                    }`}
                  >
                    <Icon className="w-4 h-4 sm:mr-2" />
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
            {activeTab === "rules" && (
              <div className="space-y-6">
                {/* Quick Stats */}
                <div className="bg-white rounded-lg shadow-lg p-6">
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


                {/* Notification Rules */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-semibold text-gray-900">
                      Add Rule
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
                          className="bg-white rounded-lg shadow-lg border border-gray-200"
                        >
                          {editingRuleIndex === index ? (
                            /* Expanded Edit Mode */
                            <div className="p-4 space-y-4">
                              {/* Row 1: Metric and Direction */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Metric
                                  </label>
                                  <select
                                    value={rule.metric}
                                    onChange={(e) =>
                                      updateRule(index, {
                                        metric: e.target.value as NotificationRule["metric"],
                                      })
                                    }
                                    className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                  >
                                    {Object.entries(METRIC_LABELS).map(([value, label]) => (
                                      <option key={value} value={value}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    When it
                                  </label>
                                  <select
                                    value={rule.direction}
                                    onChange={(e) =>
                                      updateRule(index, {
                                        direction: e.target.value as NotificationRule["direction"],
                                      })
                                    }
                                    className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                  >
                                    {Object.entries(DIRECTION_LABELS)
                                      .filter(([value]) => {
                                        if (rule.metric === "RANKING") {
                                          return ["BETTER", "WORSE", "ANY"].includes(value);
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
                              </div>

                              {/* Row 2: Threshold and Frequency */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                                          thresholdType: e.target.value as "ABSOLUTE" | "PERCENT",
                                        })
                                      }
                                      className="px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                    >
                                      <option value="PERCENT">%</option>
                                      <option value="ABSOLUTE">Abs</option>
                                    </select>
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Frequency
                                  </label>
                                  <select
                                    value={rule.frequency}
                                    onChange={(e) =>
                                      updateRule(index, {
                                        frequency: e.target.value as "INSTANT" | "DAILY_DIGEST",
                                      })
                                    }
                                    className="w-full px-3 py-2 rounded-lg text-sm bg-white border border-gray-200 shadow-inner focus:outline-none"
                                  >
                                    {Object.entries(FREQUENCY_LABELS).map(([value, label]) => (
                                      <option key={value} value={value}>
                                        {label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              {/* Row 3: User Selection */}
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  Send to Team Members
                                </label>
                                <div className="space-y-2">
                                  {teamLoading ? (
                                    <div className="flex items-center gap-2 py-2">
                                      <InlineSpinner size={16} />
                                      <span className="text-sm text-gray-600">Loading team members...</span>
                                    </div>
                                  ) : (
                                    <>
                                      {/* Current User */}
                                      <label className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50">
                                        <input
                                          type="checkbox"
                                          checked={rule.userIds.includes(user?.id || "")}
                                          onChange={(e) => {
                                            const userId = user?.id || "";
                                            const newUserIds = e.target.checked
                                              ? [...rule.userIds, userId]
                                              : rule.userIds.filter(id => id !== userId);
                                            updateRule(index, { userIds: newUserIds });
                                          }}
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-900">
                                          {user?.name || user?.email} (You)
                                        </span>
                                      </label>
                                      
                                      {/* Team Members */}
                                      {teamMembers.filter(m => m.status === "ACTIVE").map((member) => (
                                        <label key={member.id} className="flex items-center gap-2 p-2 rounded border hover:bg-gray-50">
                                          <input
                                            type="checkbox"
                                            checked={rule.userIds.includes(member.memberUserId)}
                                            onChange={(e) => {
                                              const newUserIds = e.target.checked
                                                ? [...rule.userIds, member.memberUserId]
                                                : rule.userIds.filter(id => id !== member.memberUserId);
                                              updateRule(index, { userIds: newUserIds });
                                            }}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                          />
                                          <span className="text-sm text-gray-900">
                                            {member.member.name || member.member.email}
                                          </span>
                                        </label>
                                      ))}
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Save/Cancel Controls */}
                              <div className="flex items-center justify-start gap-3 pt-2 border-t border-gray-200">
                                <Button
                                  variant="pill"
                                  className="w-24"
                                  onClick={() => saveRule(index)}
                                  disabled={savingRule === index || rule.userIds.length === 0}
                                >
                                  {savingRule === index ? (
                                    <>
                                      <InlineSpinner size={16} className="mr-1" />
                                      Saving...
                                    </>
                                  ) : (
                                    "Save"
                                  )}
                                </Button>
                                <Button
                                  variant="pill"
                                  className="w-24"
                                  onClick={() => cancelEditRule(index)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* Condensed Display Mode */
                            <div className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-900 truncate">
                                  {formatRuleDisplay(rule)}
                                </p>
                                {!rule.active && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    (Inactive)
                                  </p>
                                )}
                              </div>
                              
                              <div className="flex items-center gap-2 ml-3">
                                <button
                                  onClick={() => setEditingRuleIndex(index)}
                                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                  title="Edit rule"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => removeRule(index)}
                                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                  title="Delete rule"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          )}
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
            )}

            {activeTab === "test" && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Test Notifications
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Send test email notifications to verify your settings are working correctly.
                  </p>
                </div>

                <div className="bg-white rounded-lg shadow-lg p-6">
                  <div className="mb-4">
                    <h3 className="font-semibold text-gray-900">Send Test Email</h3>
                    <p className="text-sm text-gray-600">
                      Send test email notifications to verify your settings are working correctly.
                    </p>
                  </div>
                  <div className="space-y-4">
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
                    
                    {/* Test Tab Specific Messages */}
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                        {error}
                      </div>
                    )}
                    {successMessage && (
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
                        {successMessage}
                      </div>
                    )}
                    {testSent && !successMessage && (
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <Check className="w-4 h-4" />
                        Test notification queued successfully
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailNotificationsModal;
