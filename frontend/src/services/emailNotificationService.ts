/**
 * @file emailNotificationService.ts
 * @description Frontend service for managing email notification rules and testing.
 * Provides API methods for creating, updating, and testing email notifications.
 *
 * @dependencies
 * - ../lib/apiClient: HTTP client for API calls
 *
 * @exports
 * - NotificationRule: Type definition for notification rules
 * - getNotificationRules: Fetch notification rules
 * - createNotificationRules: Create or update notification rules
 * - deleteNotificationRule: Delete a specific notification rule
 * - sendTestNotification: Send test email notification
 * - getNotificationStats: Get notification statistics
 */

import apiClient from "../lib/apiClient";

export interface NotificationRule {
  id?: string;
  companyId?: string | null;
  metric: "RANKING" | "SOV_CHANGE" | "INCLUSION_RATE" | "SENTIMENT_SCORE";
  thresholdType: "ABSOLUTE" | "PERCENT";
  thresholdValue: number;
  direction: "UP" | "DOWN" | "BETTER" | "WORSE" | "ANY";
  frequency: "INSTANT" | "DAILY_DIGEST";
  emails: string[];
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface NotificationRulesResponse {
  rules: NotificationRule[];
  total: number;
}

export interface NotificationStats {
  totalRules: number;
  activeRules: number;
  notificationsSent24h: number;
  lastNotificationSent: string | null;
}

/**
 * Fetch notification rules for the authenticated user's account
 * @param companyId Optional company ID to filter rules
 * @returns Promise with notification rules
 */
export async function getNotificationRules(
  companyId?: string
): Promise<NotificationRulesResponse> {
  const params = new URLSearchParams();
  if (companyId) {
    params.append("companyId", companyId);
  }

  const { data } = await apiClient.get<NotificationRulesResponse>(
    `/notifications/rules?${params.toString()}`
  );
  return data;
}

/**
 * Create or update notification rules
 * @param rules Array of notification rules to create or update
 * @returns Promise with updated notification rules
 */
export async function createNotificationRules(
  rules: NotificationRule[]
): Promise<NotificationRulesResponse> {
  const { data } = await apiClient.put<NotificationRulesResponse>(
    "/notifications/rules",
    { rules }
  );
  return data;
}

/**
 * Delete a specific notification rule
 * @param ruleId ID of the rule to delete
 * @returns Promise that resolves when rule is deleted
 */
export async function deleteNotificationRule(ruleId: string): Promise<void> {
  await apiClient.delete(`/notifications/rules/${encodeURIComponent(ruleId)}`);
}

/**
 * Send a test email notification
 * @param emails Array of email addresses to send test to
 * @returns Promise that resolves with test result
 */
export async function sendTestNotification(emails: string[]): Promise<{
  success: boolean;
  message: string;
  details?: string;
}> {
  try {
    const { data } = await apiClient.post("/notifications/test", { emails });
    return data;
  } catch (err: unknown) {
    const msg =
      typeof err === "object" && err !== null
        ? (err as { response?: { data?: { error?: string } } }).response?.data
            ?.error || "Failed to send test notification"
        : "Failed to send test notification";
    throw new Error(msg);
  }
}

/**
 * Get notification statistics and recent activity
 * @param companyId Optional company ID to filter stats
 * @returns Promise with notification statistics
 */
export async function getNotificationStats(
  companyId?: string
): Promise<NotificationStats> {
  const params = new URLSearchParams();
  if (companyId) {
    params.append("companyId", companyId);
  }

  const { data } = await apiClient.get<NotificationStats>(
    `/notifications/stats?${params.toString()}`
  );
  return data;
}