/**
 * @file emailNotificationController.test.ts
 * @description Tests for the email notification controller
 */

import { Request, Response } from "express";
import {
  deleteRule,
  getRules,
  sendTestNotification,
  upsertRules,
} from "../controllers/emailNotificationController";
import emailNotificationService from "../services/emailNotificationService";

// Mock dependencies
jest.mock("../services/emailNotificationService");
jest.mock("../utils/logger");

const mockEmailNotificationService = emailNotificationService as jest.Mocked<typeof emailNotificationService>;

describe("EmailNotificationController", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnThis();

    mockResponse = {
      json: mockJson,
      status: mockStatus,
    };

    mockRequest = {
      user: { id: "user123" },
      query: {},
      body: {},
      params: {},
    };

    jest.clearAllMocks();
  });

  describe("getRules", () => {
    it("should return notification rules successfully", async () => {
      const mockRules = [
        {
          id: "rule1",
          ownerUserId: "user123",
          companyId: "company1",
          metric: "SOV_CHANGE" as const,
          thresholdType: "PERCENT" as const,
          thresholdValue: 10,
          direction: "UP" as const,
          frequency: "INSTANT" as const,
          emails: ["test@example.com"],
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockEmailNotificationService.loadAccountRules.mockResolvedValue(mockRules);

      await getRules(mockRequest as Request, mockResponse as Response);

      expect(mockEmailNotificationService.loadAccountRules).toHaveBeenCalledWith("user123", undefined);
      expect(mockJson).toHaveBeenCalledWith({
        rules: mockRules,
        total: 1,
      });
    });

    it("should filter by companyId when provided", async () => {
      mockRequest.query = { companyId: "company1" };
      mockEmailNotificationService.loadAccountRules.mockResolvedValue([]);

      await getRules(mockRequest as Request, mockResponse as Response);

      expect(mockEmailNotificationService.loadAccountRules).toHaveBeenCalledWith("user123", "company1");
    });

    it("should handle service errors", async () => {
      mockEmailNotificationService.loadAccountRules.mockRejectedValue(new Error("Service error"));

      await getRules(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Failed to fetch notification rules",
        details: "Service error",
      });
    });

    it("should validate companyId parameter", async () => {
      mockRequest.query = { companyId: 123 }; // Invalid type

      await getRules(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid companyId parameter",
      });
    });
  });

  describe("upsertRules", () => {
    const validRule = {
      metric: "RANKING" as const,
      thresholdType: "ABSOLUTE" as const,
      thresholdValue: 3,
      direction: "BETTER" as const,
      frequency: "INSTANT" as const,
      emails: ["admin@company.com"],
      active: true,
    };

    it("should create rules successfully", async () => {
      mockRequest.body = { rules: [validRule] };
      
      const createdRule = {
        id: "new-rule",
        ownerUserId: "user123",
        companyId: null,
        ...validRule,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockEmailNotificationService.upsertRules.mockResolvedValue([createdRule]);

      await upsertRules(mockRequest as Request, mockResponse as Response);

      expect(mockEmailNotificationService.upsertRules).toHaveBeenCalledWith("user123", [validRule]);
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        rules: [createdRule],
        total: 1,
      });
    });

    it("should validate request body", async () => {
      mockRequest.body = { rules: [] }; // Empty rules array

      await upsertRules(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid request data",
        details: expect.any(Array),
      });
    });

    it("should validate rule direction for ranking metrics", async () => {
      mockRequest.body = {
        rules: [
          {
            ...validRule,
            metric: "RANKING",
            direction: "UP", // Invalid for ranking
          },
        ],
      };

      await upsertRules(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid direction for ranking metric",
        details: "Ranking metrics must use BETTER, WORSE, or ANY direction",
      });
    });

    it("should validate rule direction for non-ranking metrics", async () => {
      mockRequest.body = {
        rules: [
          {
            ...validRule,
            metric: "SOV_CHANGE",
            direction: "BETTER", // Invalid for non-ranking
          },
        ],
      };

      await upsertRules(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid direction for non-ranking metric",
        details: "Only ranking metrics can use BETTER/WORSE direction",
      });
    });

    it("should validate percentage thresholds", async () => {
      mockRequest.body = {
        rules: [
          {
            ...validRule,
            thresholdType: "PERCENT",
            thresholdValue: 5000, // Unreasonable percentage
          },
        ],
      };

      await upsertRules(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid percentage threshold",
        details: "Percentage thresholds should be reasonable (typically 0-100%)",
      });
    });

    it("should handle service errors", async () => {
      mockRequest.body = { rules: [validRule] };
      mockEmailNotificationService.upsertRules.mockRejectedValue(new Error("Service error"));

      await upsertRules(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Failed to update notification rules",
        details: "Service error",
      });
    });
  });

  describe("deleteRule", () => {
    it("should delete rule successfully", async () => {
      mockRequest.params = { id: "rule-to-delete" };
      mockEmailNotificationService.deleteRule.mockResolvedValue();

      await deleteRule(mockRequest as Request, mockResponse as Response);

      expect(mockEmailNotificationService.deleteRule).toHaveBeenCalledWith("user123", "rule-to-delete");
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Notification rule deleted successfully",
      });
    });

    it("should validate rule ID parameter", async () => {
      mockRequest.params = {}; // Missing ID

      await deleteRule(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Rule ID is required",
      });
    });

    it("should handle not found errors", async () => {
      mockRequest.params = { id: "nonexistent-rule" };
      mockEmailNotificationService.deleteRule.mockRejectedValue(
        new Error("Record to delete does not exist")
      );

      await deleteRule(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Notification rule not found",
      });
    });

    it("should handle service errors", async () => {
      mockRequest.params = { id: "rule-to-delete" };
      mockEmailNotificationService.deleteRule.mockRejectedValue(new Error("Service error"));

      await deleteRule(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Failed to delete notification rule",
        details: "Service error",
      });
    });
  });

  describe("sendTestNotification", () => {
    it("should send test notification successfully", async () => {
      mockRequest.body = { emails: ["test@example.com", "admin@company.com"] };
      mockEmailNotificationService.sendTestNotification.mockResolvedValue();

      await sendTestNotification(mockRequest as Request, mockResponse as Response);

      expect(mockEmailNotificationService.sendTestNotification).toHaveBeenCalledWith(
        "user123",
        ["test@example.com", "admin@company.com"]
      );
      expect(mockJson).toHaveBeenCalledWith({
        success: true,
        message: "Test notification queued successfully",
        details: "Test email will be sent to 2 recipient(s)",
      });
    });

    it("should validate request body", async () => {
      mockRequest.body = { emails: [] }; // Empty emails array

      await sendTestNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid request data",
        details: expect.any(Array),
      });
    });

    it("should validate email formats", async () => {
      mockRequest.body = { emails: ["invalid-email"] };

      await sendTestNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Invalid request data",
        details: expect.any(Array),
      });
    });

    it("should handle service errors", async () => {
      mockRequest.body = { emails: ["test@example.com"] };
      mockEmailNotificationService.sendTestNotification.mockRejectedValue(
        new Error("Service error")
      );

      await sendTestNotification(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: "Failed to send test notification",
        details: "Service error",
      });
    });
  });
});