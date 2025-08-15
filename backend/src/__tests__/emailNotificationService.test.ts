/**
 * @file emailNotificationService.test.ts
 * @description Tests for the email notification service
 */

import { getDbClient } from "../config/database";
import emailNotificationService from "../services/emailNotificationService";

// Mock dependencies
jest.mock("../config/database");
jest.mock("../queues/emailNotificationQueue");
jest.mock("../utils/logger");

const mockPrisma = {
  notificationRule: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  notificationEvent: {
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
  },
  reportMetric: {
    findMany: jest.fn(),
  },
  reportRun: {
    findFirst: jest.fn(),
  },
  company: {
    findUnique: jest.fn(),
  },
};

(getDbClient as jest.Mock).mockResolvedValue(mockPrisma);

describe("EmailNotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("loadAccountRules", () => {
    it("should load notification rules for account", async () => {
      const mockRules = [
        {
          id: "rule1",
          ownerUserId: "user1",
          companyId: "company1",
          metric: "SOV_CHANGE",
          thresholdType: "PERCENT",
          thresholdValue: 10,
          direction: "UP",
          frequency: "INSTANT",
          emails: ["test@example.com"],
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.notificationRule.findMany.mockResolvedValue(mockRules);

      const result = await emailNotificationService.loadAccountRules("user1", "company1");

      expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledWith({
        where: {
          ownerUserId: "user1",
          active: true,
          AND: [
            {
              OR: [{ companyId: "company1" }, { companyId: null }],
            },
          ],
        },
        orderBy: { createdAt: "desc" },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("rule1");
    });

    it("should load all company rules when no companyId provided", async () => {
      mockPrisma.notificationRule.findMany.mockResolvedValue([]);

      await emailNotificationService.loadAccountRules("user1");

      expect(mockPrisma.notificationRule.findMany).toHaveBeenCalledWith({
        where: {
          ownerUserId: "user1",
          active: true,
          AND: undefined,
        },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("upsertRules", () => {
    it("should create new rules", async () => {
      const newRule = {
        metric: "RANKING" as const,
        thresholdType: "ABSOLUTE" as const,
        thresholdValue: 3,
        direction: "WORSE" as const,
        frequency: "INSTANT" as const,
        emails: ["admin@company.com"],
        active: true,
      };

      const createdRule = {
        id: "new-rule-id",
        ownerUserId: "user1",
        companyId: null,
        ...newRule,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.notificationRule.create.mockResolvedValue(createdRule);

      const result = await emailNotificationService.upsertRules("user1", [newRule]);

      expect(mockPrisma.notificationRule.create).toHaveBeenCalledWith({
        data: {
          ownerUserId: "user1",
          companyId: null,
          ...newRule,
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("new-rule-id");
    });

    it("should update existing rules", async () => {
      const existingRule = {
        id: "existing-rule",
        metric: "SOV_CHANGE" as const,
        thresholdType: "PERCENT" as const,
        thresholdValue: 15,
        direction: "UP" as const,
        frequency: "DAILY_DIGEST" as const,
        emails: ["updated@company.com"],
        active: false,
      };

      const updatedRule = {
        ...existingRule,
        ownerUserId: "user1",
        companyId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrisma.notificationRule.update.mockResolvedValue(updatedRule);

      const result = await emailNotificationService.upsertRules("user1", [existingRule]);

      expect(mockPrisma.notificationRule.update).toHaveBeenCalledWith({
        where: { id: "existing-rule", ownerUserId: "user1" },
        data: {
          metric: "SOV_CHANGE",
          thresholdType: "PERCENT",
          thresholdValue: 15,
          direction: "UP",
          frequency: "DAILY_DIGEST",
          emails: ["updated@company.com"],
          active: false,
          companyId: undefined,
          updatedAt: expect.any(Date),
        },
      });

      expect(result).toHaveLength(1);
      expect(result[0].emails).toEqual(["updated@company.com"]);
    });
  });

  describe("deleteRule", () => {
    it("should delete a notification rule", async () => {
      mockPrisma.notificationRule.delete.mockResolvedValue({});

      await emailNotificationService.deleteRule("user1", "rule-to-delete");

      expect(mockPrisma.notificationRule.delete).toHaveBeenCalledWith({
        where: { id: "rule-to-delete", ownerUserId: "user1" },
      });
    });
  });

  describe("metric value extraction", () => {
    it("should extract ranking position correctly", () => {
      const service = emailNotificationService as any;
      
      const rankingValue = service.extractMetricValue("RANKING", { position: 5 });
      expect(rankingValue).toBe(5);

      const rankingValueString = service.extractMetricValue("RANKING", JSON.stringify({ rank: 3 }));
      expect(rankingValueString).toBe(3);
    });

    it("should extract share of voice percentage correctly", () => {
      const service = emailNotificationService as any;
      
      const sovValue = service.extractMetricValue("SOV_CHANGE", { shareOfVoice: 25.5 });
      expect(sovValue).toBe(25.5);

      const sovValueString = service.extractMetricValue("SOV_CHANGE", JSON.stringify({ percentage: 30.2 }));
      expect(sovValueString).toBe(30.2);
    });

    it("should extract inclusion rate correctly", () => {
      const service = emailNotificationService as any;
      
      const inclusionValue = service.extractMetricValue("INCLUSION_RATE", { inclusionRate: 85.7 });
      expect(inclusionValue).toBe(85.7);

      const inclusionValueString = service.extractMetricValue("INCLUSION_RATE", JSON.stringify({ rate: 92.3 }));
      expect(inclusionValueString).toBe(92.3);
    });

    it("should extract sentiment score correctly", () => {
      const service = emailNotificationService as any;
      
      const sentimentValue = service.extractMetricValue("SENTIMENT_SCORE", { sentimentScore: 0.75 });
      expect(sentimentValue).toBe(0.75);

      const sentimentValueString = service.extractMetricValue("SENTIMENT_SCORE", JSON.stringify({ score: 0.82 }));
      expect(sentimentValueString).toBe(0.82);
    });

    it("should handle invalid metric values gracefully", () => {
      const service = emailNotificationService as any;
      
      const invalidValue = service.extractMetricValue("RANKING", "invalid-json");
      expect(invalidValue).toBe(0);

      const missingValue = service.extractMetricValue("SOV_CHANGE", {});
      expect(missingValue).toBe(0);
    });
  });

  describe("rule evaluation", () => {
    it("should trigger on percentage increase above threshold", async () => {
      const service = emailNotificationService as any;
      
      const rule = {
        id: "rule1",
        metric: "SOV_CHANGE",
        thresholdType: "PERCENT",
        thresholdValue: 10,
        direction: "UP",
        frequency: "INSTANT",
      };

      const metricData = {
        metric: "SOV_CHANGE",
        currentValue: 33,
        previousValue: 30,
        companyId: "company1",
        companyName: "Test Company",
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, metricData);

      expect(result.triggered).toBe(true);
      expect(result.direction).toBe("UP");
      expect(result.changePercent).toBe(10); // (33-30)/30 * 100 = 10%
    });

    it("should trigger on absolute ranking improvement", async () => {
      const service = emailNotificationService as any;
      
      const rule = {
        id: "rule1",
        metric: "RANKING",
        thresholdType: "ABSOLUTE",
        thresholdValue: 2,
        direction: "BETTER",
        frequency: "INSTANT",
      };

      const metricData = {
        metric: "RANKING",
        currentValue: 3,
        previousValue: 5,
        companyId: "company1",
        companyName: "Test Company",
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, metricData);

      expect(result.triggered).toBe(true);
      expect(result.direction).toBe("BETTER");
      expect(result.changeValue).toBe(-2); // 3-5 = -2 (better ranking)
    });

    it("should not trigger when threshold not met", async () => {
      const service = emailNotificationService as any;
      
      const rule = {
        id: "rule1",
        metric: "SOV_CHANGE",
        thresholdType: "PERCENT",
        thresholdValue: 20,
        direction: "UP",
        frequency: "INSTANT",
      };

      const metricData = {
        metric: "SOV_CHANGE",
        currentValue: 31,
        previousValue: 30,
        companyId: "company1",
        companyName: "Test Company",
        timestamp: new Date(),
      };

      const result = await service.evaluateRule(rule, metricData);

      expect(result.triggered).toBe(false);
      expect(result.changePercent).toBeCloseTo(3.33); // (31-30)/30 * 100 = 3.33%
    });

    it("should trigger on ANY direction change above threshold", async () => {
      const service = emailNotificationService as any;
      
      const rule = {
        id: "rule1",
        metric: "SENTIMENT_SCORE",
        thresholdType: "ABSOLUTE",
        thresholdValue: 0.1,
        direction: "ANY",
        frequency: "INSTANT",
      };

      const metricDataUp = {
        metric: "SENTIMENT_SCORE",
        currentValue: 0.85,
        previousValue: 0.7,
        companyId: "company1",
        companyName: "Test Company",
        timestamp: new Date(),
      };

      const resultUp = await service.evaluateRule(rule, metricDataUp);
      expect(resultUp.triggered).toBe(true);
      expect(resultUp.direction).toBe("UP");

      const metricDataDown = {
        metric: "SENTIMENT_SCORE",
        currentValue: 0.6,
        previousValue: 0.75,
        companyId: "company1",
        companyName: "Test Company",
        timestamp: new Date(),
      };

      const resultDown = await service.evaluateRule(rule, metricDataDown);
      expect(resultDown.triggered).toBe(true);
      expect(resultDown.direction).toBe("DOWN");
    });
  });
});