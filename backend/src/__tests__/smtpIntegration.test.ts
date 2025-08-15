/**
 * @file smtpIntegration.test.ts
 * @description Tests for SMTP integration with AWS Secrets Manager
 */

import { testSmtpConnection } from "../services/mailerService";
import { SecretsProviderFactory } from "../services/secretsProvider";

// Mock AWS SDK and nodemailer
jest.mock("@aws-sdk/client-secrets-manager");
jest.mock("nodemailer");

const mockNodemailer = require("nodemailer");

describe("SMTP Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset any cached configurations
    jest.resetModules();
  });

  describe("testSmtpConnection", () => {
    it("should return success when SMTP is properly configured", async () => {
      // Mock nodemailer transporter
      const mockTransporter = {
        verify: jest.fn().mockResolvedValue(true),
      };
      
      mockNodemailer.createTransport = jest.fn().mockReturnValue(mockTransporter);

      // Mock environment variables for environment provider
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASSWORD = "password";
      process.env.SMTP_FROM_EMAIL = "noreply@example.com";
      process.env.SMTP_PORT = "587";

      const result = await testSmtpConnection();

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockTransporter.verify).toHaveBeenCalled();
    });

    it("should return error when SMTP verification fails", async () => {
      // Mock nodemailer transporter that fails verification
      const mockTransporter = {
        verify: jest.fn().mockRejectedValue(new Error("SMTP connection failed")),
      };
      
      mockNodemailer.createTransport = jest.fn().mockReturnValue(mockTransporter);

      // Mock environment variables
      process.env.SMTP_HOST = "smtp.example.com";
      process.env.SMTP_USER = "test@example.com";
      process.env.SMTP_PASSWORD = "password";
      process.env.SMTP_FROM_EMAIL = "noreply@example.com";

      const result = await testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP connection failed");
    });

    it("should return error when SMTP is not configured", async () => {
      // Clear environment variables
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASSWORD;
      delete process.env.SMTP_FROM_EMAIL;

      const result = await testSmtpConnection();

      expect(result.success).toBe(false);
      expect(result.error).toBe("SMTP not configured");
    });
  });

  describe("SecretsProvider SMTP Integration", () => {
    it("should retrieve SMTP credentials from AWS Secrets Manager", async () => {
      // Mock AWS Secrets Manager response
      const mockAwsSecret = {
        host: "email-smtp.us-east-1.amazonaws.com",
        port: "587",
        user: "AKIAXXXXXXXXXXXXXXXX",
        password: "BBBBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        fromEmail: "noreply@serplexity.com",
      };

      const mockSecretsManagerClient = {
        send: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(mockAwsSecret),
          VersionId: "12345",
          CreatedDate: new Date(),
        }),
      };

      // Mock AWS SDK
      const mockSecretsManager = require("@aws-sdk/client-secrets-manager");
      mockSecretsManager.SecretsManagerClient = jest.fn().mockReturnValue(mockSecretsManagerClient);
      mockSecretsManager.GetSecretValueCommand = jest.fn().mockImplementation((params) => params);

      // Set up environment for AWS secrets
      process.env.SECRETS_PROVIDER = "aws";
      process.env.AWS_REGION = "us-east-1";
      process.env.AWS_ACCESS_KEY_ID = "test";
      process.env.AWS_SECRET_ACCESS_KEY = "test";

      const secretsProvider = SecretsProviderFactory.createProvider("aws");
      const result = await secretsProvider.getSmtpSecret("serplexity/prod/smtp");

      expect(result.secret.host).toBe("email-smtp.us-east-1.amazonaws.com");
      expect(result.secret.port).toBe(587);
      expect(result.secret.user).toBe("AKIAXXXXXXXXXXXXXXXX");
      expect(result.secret.password).toBe("BBBBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx");
      expect(result.secret.fromEmail).toBe("noreply@serplexity.com");
      expect(result.metadata.provider).toBe("AWS_SECRETS_MANAGER");
    });

    it("should handle flexible SMTP secret field names", async () => {
      // Test different field name formats
      const mockAwsSecret = {
        smtp_host: "email-smtp.us-east-1.amazonaws.com",
        smtp_port: "587",
        smtp_user: "AKIAXXXXXXXXXXXXXXXX", 
        smtp_password: "BBBBxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
        smtp_from_email: "noreply@serplexity.com",
      };

      const mockSecretsManagerClient = {
        send: jest.fn().mockResolvedValue({
          SecretString: JSON.stringify(mockAwsSecret),
          VersionId: "12345",
          CreatedDate: new Date(),
        }),
      };

      const mockSecretsManager = require("@aws-sdk/client-secrets-manager");
      mockSecretsManager.SecretsManagerClient = jest.fn().mockReturnValue(mockSecretsManagerClient);
      mockSecretsManager.GetSecretValueCommand = jest.fn().mockImplementation((params) => params);

      const secretsProvider = SecretsProviderFactory.createProvider("aws");
      const result = await secretsProvider.getSmtpSecret("serplexity/prod/smtp");

      expect(result.secret.host).toBe("email-smtp.us-east-1.amazonaws.com");
      expect(result.secret.port).toBe(587);
      expect(result.secret.user).toBe("AKIAXXXXXXXXXXXXXXXX");
      expect(result.secret.fromEmail).toBe("noreply@serplexity.com");
    });

    it("should throw error when SMTP secret is not found", async () => {
      const mockSecretsManagerClient = {
        send: jest.fn().mockRejectedValue(new Error("ResourceNotFoundException")),
      };

      const mockSecretsManager = require("@aws-sdk/client-secrets-manager");
      mockSecretsManager.SecretsManagerClient = jest.fn().mockReturnValue(mockSecretsManagerClient);
      mockSecretsManager.GetSecretValueCommand = jest.fn().mockImplementation((params) => params);

      const secretsProvider = SecretsProviderFactory.createProvider("aws");
      
      await expect(secretsProvider.getSmtpSecret("nonexistent/secret")).rejects.toThrow();
    });
  });

  describe("Environment Provider SMTP Integration", () => {
    it("should retrieve SMTP credentials from environment variables", async () => {
      process.env.SMTP_HOST = "smtp.gmail.com";
      process.env.SMTP_PORT = "587";
      process.env.SMTP_USER = "test@gmail.com";
      process.env.SMTP_PASSWORD = "app-password";
      process.env.SMTP_FROM_EMAIL = "noreply@example.com";

      const secretsProvider = SecretsProviderFactory.createProvider("environment");
      const result = await secretsProvider.getSmtpSecret("test");

      expect(result.secret.host).toBe("smtp.gmail.com");
      expect(result.secret.port).toBe(587);
      expect(result.secret.user).toBe("test@gmail.com");
      expect(result.secret.password).toBe("app-password");
      expect(result.secret.fromEmail).toBe("noreply@example.com");
      expect(result.secret.secure).toBe(false);
    });

    it("should detect secure connection for port 465", async () => {
      process.env.SMTP_HOST = "smtp.gmail.com";
      process.env.SMTP_PORT = "465";
      process.env.SMTP_USER = "test@gmail.com";
      process.env.SMTP_PASSWORD = "app-password";
      process.env.SMTP_FROM_EMAIL = "noreply@example.com";

      const secretsProvider = SecretsProviderFactory.createProvider("environment");
      const result = await secretsProvider.getSmtpSecret("test");

      expect(result.secret.secure).toBe(true);
    });

    it("should throw error when environment variables are missing", async () => {
      delete process.env.SMTP_HOST;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASSWORD;
      delete process.env.SMTP_FROM_EMAIL;

      const secretsProvider = SecretsProviderFactory.createProvider("environment");
      
      await expect(secretsProvider.getSmtpSecret("test")).rejects.toThrow(
        "SMTP environment variables not set"
      );
    });
  });
});