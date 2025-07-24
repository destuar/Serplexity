/**
 * @file analyticsService.ts
 * @description This file defines the `AnalyticsService`, which provides functionalities for tracking user events and page views using Redis.
 * It allows for recording various user interactions, page visits, and session data, and provides methods for retrieving daily analytics
 * summaries and user journeys. This service is crucial for understanding user behavior, optimizing the application, and making data-driven decisions.
 *
 * @dependencies
 * - ../config/redis: The Redis client for storing analytics data.
 * - ../utils/logger: Logger for application-level logging.
 * - zod: For schema validation (though currently used implicitly).
 *
 * @exports
 * - AnalyticsService: The class providing analytics tracking functionalities.
 * - ANALYTICS_EVENTS: A constant object defining various application-specific event types.
 * - getRawEvents: Function to retrieve raw events from Redis.
 * - getRawPageViews: Function to retrieve raw page views from Redis.
 */
import { redis } from "../config/redis";
import logger from "../utils/logger";
import { z as _z } from "zod";

export interface UserEvent {
  userId?: string;
  sessionId: string;
  event: string;
  page?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface PageView {
  userId?: string;
  sessionId: string;
  page: string;
  referrer?: string;
  userAgent: string;
  timestamp: number;
  duration?: number;
}

export class AnalyticsService {
  private readonly TTL = 30 * 24 * 60 * 60; // 30 days

  // Track user events
  async trackEvent(event: UserEvent): Promise<void> {
    try {
      const key = `analytics:events:${this.getDateKey()}`;
      const eventData = JSON.stringify(event);

      await redis.lpush(key, eventData);
      await redis.expire(key, this.TTL);

      // Also track by user if available
      if (event.userId) {
        const userKey = `analytics:user:${event.userId}:events`;
        await redis.lpush(userKey, eventData);
        await redis.expire(userKey, this.TTL);
      }
    } catch (error) {
      logger.error("Error tracking event:", error);
    }
  }

  // Track page views
  async trackPageView(pageView: PageView): Promise<void> {
    try {
      const key = `analytics:pageviews:${this.getDateKey()}`;
      const pageViewData = JSON.stringify(pageView);

      await redis.lpush(key, pageViewData);
      await redis.expire(key, this.TTL);

      // Track page popularity
      const pageKey = `analytics:pages:${pageView.page}:${this.getDateKey()}`;
      await redis.incr(pageKey);
      await redis.expire(pageKey, this.TTL);

      // Track user session
      if (pageView.userId) {
        const sessionKey = `analytics:session:${pageView.sessionId}`;
        await redis.hset(sessionKey, {
          userId: pageView.userId,
          lastSeen: pageView.timestamp,
          currentPage: pageView.page,
        });
        await redis.expire(sessionKey, 24 * 60 * 60); // 24 hours
      }
    } catch (error) {
      logger.error("Error tracking page view:", error);
    }
  }

  // Get daily analytics summary
  async getDailyAnalytics(date?: string): Promise<unknown> {
    try {
      const dateKey = date || this.getDateKey();

      const [events, pageViews, uniquePages] = await Promise.all([
        this.getEventsByDate(dateKey),
        this.getPageViewsByDate(dateKey),
        this.getUniquePagesByDate(dateKey),
      ]);

      return {
        date: dateKey,
        totalEvents: events.length,
        totalPageViews: pageViews.length,
        uniquePages: Object.keys(uniquePages).length,
        popularPages: this.getTopPages(uniquePages),
        eventBreakdown: this.getEventBreakdown(events),
      };
    } catch (error) {
      logger.error("Error getting daily analytics:", error);
      return null;
    }
  }

  // Track user journey
  async getUserJourney(userId: string, _days: number = 7): Promise<unknown[]> {
    try {
      const _journey = [];
      const userKey = `analytics:user:${userId}:events`;

      const events = await redis.lrange(userKey, 0, -1);
      if (!events || events.length === 0) {
        return [];
      }

      const parsedEvents = events
        .map((event: string) => JSON.parse(event))
        .filter((event: UserEvent): event is UserEvent => {
          // Basic validation, can be enhanced with Zod
          return (
            event &&
            typeof event.timestamp === "number" &&
            typeof event.event === "string"
          );
        })
        .sort((a: UserEvent, b: UserEvent) => a.timestamp - b.timestamp);

      return parsedEvents;
    } catch (error) {
      logger.error("Error getting user journey:", error);
      return [];
    }
  }

  // Helper methods
  private getDateKey(timestamp?: number): string {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toISOString().split("T")[0]; // YYYY-MM-DD
  }

  private async getEventsByDate(dateKey: string): Promise<unknown[]> {
    const key = `analytics:events:${dateKey}`;
    const events = await redis.lrange(key, 0, -1);
    return events.map((event: string) => JSON.parse(event));
  }

  private async getPageViewsByDate(dateKey: string): Promise<unknown[]> {
    const key = `analytics:pageviews:${dateKey}`;
    const pageViews = await redis.lrange(key, 0, -1);
    return pageViews.map((pv: string) => JSON.parse(pv));
  }

  private async getUniquePagesByDate(
    dateKey: string,
  ): Promise<Record<string, number>> {
    const keys = await redis.keys(`analytics:pages:*:${dateKey}`);
    const pages: Record<string, number> = {};

    for (const key of keys) {
      const pageName = key.split(":")[2];
      const count = await redis.get(key);
      pages[pageName] = parseInt(count || "0", 10);
    }

    return pages;
  }

  private getTopPages(
    pages: Record<string, number>,
  ): Array<{ page: string; views: number }> {
    return Object.entries(pages)
      .map(([page, views]) => ({ page, views }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }

  private getEventBreakdown(events: UserEvent[]): Record<string, number> {
    const breakdown: Record<string, number> = {};
    events.forEach((event) => {
      breakdown[event.event] = (breakdown[event.event] || 0) + 1;
    });
    return breakdown;
  }
}

export default new AnalyticsService();

// Serplexity-specific event tracking constants
export const ANALYTICS_EVENTS = {
  // Auth events
  USER_LOGIN: "user_login",
  USER_LOGOUT: "user_logout",
  USER_REGISTER: "user_register",

  // Business events
  REPORT_GENERATED: "report_generated",
  REPORT_VIEWED: "report_viewed",
  DASHBOARD_VIEWED: "dashboard_viewed",

  // Feature usage
  COMPETITOR_ADDED: "competitor_added",
  OPTIMIZATION_VIEWED: "optimization_viewed",
  SETTINGS_UPDATED: "settings_updated",

  // Subscription events
  SUBSCRIPTION_STARTED: "subscription_started",
  PAYMENT_COMPLETED: "payment_completed",
} as const;

export async function getRawEvents(companyId: string): Promise<unknown[]> {
  const key = `raw_events:${companyId}`;
  try {
    const events = await redis.lrange(key, 0, -1);
    if (!events) return [];
    return events.map((event: string) => JSON.parse(event));
  } catch (error) {
    logger.error("Error fetching raw events from Redis:", error);
    return [];
  }
}

export async function getRawPageViews(companyId: string): Promise<unknown[]> {
  const key = `raw_page_views:${companyId}`;
  try {
    const pageViews = await redis.lrange(key, 0, -1);
    if (!pageViews) return [];
    return pageViews.map((pv: string) => JSON.parse(pv));
  } catch (error) {
    logger.error("Error fetching raw page views from Redis:", error);
    return [];
  }
}
