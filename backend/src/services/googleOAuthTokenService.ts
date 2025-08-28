import { dbCache } from "../config/dbCache";
import { decryptString, encryptString, sha256Hex } from "../utils/encryption";
import logger from "../utils/logger";

export interface StoredGoogleToken {
  accessToken: string;
  refreshToken?: string;
  expiry?: Date | null;
  scopes: string[];
}

class GoogleOAuthTokenService {
  async upsertToken(
    companyId: string,
    scopes: string[],
    accessToken: string,
    refreshToken?: string,
    expiryMs?: number,
    provider = "google"
  ): Promise<void> {
    const prisma = await dbCache.getPrimaryClient();
    const encryptedAccess = await encryptString(accessToken, { companyId });
    const encryptedRefresh = refreshToken
      ? await encryptString(refreshToken, { companyId })
      : null;
    const tokenHash = refreshToken ? sha256Hex(refreshToken) : null;
    const expiry = expiryMs ? new Date(expiryMs) : null;

    // Only one token per company+provider; if multiple scopes, we merge them
    const existing = await prisma.googleOAuthToken.findFirst({
      where: { companyId, provider },
    });

    if (existing) {
      const mergedScopes = Array.from(
        new Set([...(existing.scopes || []), ...scopes])
      );
      await prisma.googleOAuthToken.update({
        where: { id: existing.id },
        data: {
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh ?? existing.refreshToken,
          tokenHash: tokenHash ?? existing.tokenHash,
          expiry: expiry ?? existing.expiry,
          scopes: mergedScopes,
          revokedAt: null,
        },
      });
    } else {
      await prisma.googleOAuthToken.create({
        data: {
          companyId,
          provider,
          scopes,
          accessToken: encryptedAccess,
          refreshToken: encryptedRefresh,
          tokenHash,
          expiry,
        },
      });
    }
  }

  async getDecryptedToken(
    companyId: string,
    provider = "google"
  ): Promise<StoredGoogleToken | null> {
    const prisma = await dbCache.getPrimaryClient();
    const row = await prisma.googleOAuthToken.findFirst({
      where: { companyId, provider, revokedAt: null },
      orderBy: { updatedAt: "desc" },
    });
    if (!row) return null;
    try {
      const accessToken = await decryptString(row.accessToken, { companyId });
      const refreshToken = row.refreshToken
        ? await decryptString(row.refreshToken, { companyId })
        : undefined;
      return {
        accessToken,
        refreshToken,
        expiry: row.expiry,
        scopes: row.scopes,
      };
    } catch (error) {
      logger.error("[GoogleOAuthTokenService] Failed to decrypt token", {
        companyId,
        error,
      });
      return null;
    }
  }

  async markRevoked(companyId: string, provider = "google"): Promise<void> {
    const prisma = await dbCache.getPrimaryClient();
    await prisma.googleOAuthToken.updateMany({
      where: { companyId, provider, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export const googleOAuthTokenService = new GoogleOAuthTokenService();
export default googleOAuthTokenService;
