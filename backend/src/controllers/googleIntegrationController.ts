import { Request, Response } from "express";
import { z } from "zod";
import { googleAnalyticsService } from "../services/googleAnalyticsService";
import { googleOAuthTokenService } from "../services/googleOAuthTokenService";
import { googleSearchConsoleService } from "../services/googleSearchConsoleService";
import { websiteAnalyticsService } from "../services/websiteAnalyticsService";
import logger from "../utils/logger";

const AuthQuerySchema = z.object({
  provider: z.enum(["ga4", "gsc"]),
});

export const startGoogleAuth = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: "Company not found" });
      return;
    }
    const { provider } = AuthQuerySchema.parse(req.query);

    const integrationName =
      provider === "ga4" ? "google_analytics_4" : "google_search_console";
    const { integration } = await websiteAnalyticsService.createIntegration({
      companyId,
      integrationName: integrationName as any,
      verificationMethod: "oauth",
    });

    const authUrl =
      provider === "ga4"
        ? googleAnalyticsService.getAuthUrl(integration.id)
        : googleSearchConsoleService.getAuthUrl(integration.id);

    res.redirect(authUrl);
  } catch (error) {
    logger.error("Error starting Google OAuth:", error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: "Invalid provider" });
      return;
    }
    res.status(500).json({ error: "Failed to initiate OAuth" });
  }
};

export const revokeGoogleTokens = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const companyId = req.user?.companyId;
    if (!companyId) {
      res.status(401).json({ error: "Company not found" });
      return;
    }
    const stored = await googleOAuthTokenService.getDecryptedToken(companyId);
    if (stored?.accessToken) {
      // Best-effort revoke
      try {
        await fetch("https://oauth2.googleapis.com/revoke", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ token: stored.accessToken }),
        });
      } catch {}
    }
    await googleOAuthTokenService.markRevoked(companyId);
    res.json({ success: true });
  } catch (error) {
    logger.error("Error revoking Google tokens:", error);
    res.status(500).json({ error: "Failed to revoke tokens" });
  }
};
